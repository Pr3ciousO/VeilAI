"use client";

import { use, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { GlassCard, PillButton, StatusChip, Badge } from "@/components/ui";
import { api, type Job } from "@/lib/api";
import { usdc, short } from "@/lib/format";
import { getUserKey, openResult } from "@/lib/userkey";
import { motion, AnimatePresence } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";

export default function JobDetail({ params }: PageProps<"/jobs/[id]">) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [revealErr, setRevealErr] = useState<string | null>(null);

  async function refresh() {
    const r = await api.job(id);
    setJob(r.job);
  }
  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, [id]);

  async function runEnclave() {
    if (!job) return;
    setErr(null);
    setRunning(true);
    try {
      const { publicB58 } = getUserKey();
      await api.execute(job.id, publicB58);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  }

  async function reveal() {
    setRevealErr(null);
    try {
      const r = await api.result(id);
      const box = r.result.output_ciphertext;
      if (!box) {
        setRevealErr("No sealed output recorded for this job yet.");
        return;
      }
      // The output is sealed to the x25519 key of the browser that ran the
      // enclave — not to the wallet. Another browser (or this one after
      // localStorage was cleared) simply cannot open it.
      const { publicB58 } = getUserKey();
      const sealedTo = r.result.output_recipient_pubkey;
      if (sealedTo && sealedTo !== publicB58) {
        setRevealErr(
          "This result is sealed to the key of the browser that ran the job. Only that browser can decrypt it.",
        );
        return;
      }
      setResult(await openResult(box));
    } catch {
      setRevealErr(
        "Could not decrypt this result — it was sealed to a different key than the one in this browser.",
      );
    }
  }

  if (!job) {
    return (
      <>
        <AppNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 text-fog">
          {err ? <span className="text-reject">{err}</span> : "Loading…"}
        </main>
      </>
    );
  }

  const verified = job.status === "Verified" || job.status === "Settled";
  const rejected = job.status === "Rejected";

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-snow">
              {job.title ?? `Job #${job.job_id}`}
            </h1>
            <p className="mt-1 text-sm text-fog">Provider {short(job.provider)}</p>
          </div>
          <StatusChip status={job.status as never} />
        </div>

        {/* Private task — redacted */}
        <GlassCard className="mb-4 p-6">
          <div className="text-[11px] uppercase tracking-wider text-steel">Private task</div>
          <div className="mt-2 select-none font-mono text-sm text-iron">
            ████████████████████████████ ████████ ██████████████
          </div>
          <p className="mt-2 text-xs text-steel">
            Encrypted to the enclave — never stored as plaintext or public state.
          </p>
        </GlassCard>

        {/* Lifecycle checklist */}
        <GlassCard className="mb-4 flex flex-col gap-3 p-6">
          <Step done label="Escrowed" note={usdc(job.budget)} />
          <Step done={verified || rejected} active={running} label="Executed in enclave" />
          <Step done={verified || rejected} label="Attested (TDX quote)" />
          <Step
            done={verified}
            failed={rejected}
            label="Verified — quote valid + measurement allowlisted"
          />
          <Step done={job.status === "Settled"} label="Settled" />
        </GlassCard>

        {/* Verification result */}
        <AnimatePresence>
          {(verified || rejected) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4"
            >
              <GlassCard className={`p-6 ${verified ? "border-verify/40" : "border-reject/40"}`} raised>
                <div className="flex items-center gap-3">
                  <HugeiconsIcon
                    icon={verified ? CheckmarkCircle02Icon : CancelCircleIcon}
                    size={28}
                    className={verified ? "text-verify" : "text-reject"}
                  />
                  <div>
                    <div className={`text-lg font-semibold ${verified ? "text-verify" : "text-reject"}`}>
                      {verified ? "VERIFIED" : "REJECTED"}
                    </div>
                    <div className="text-xs text-fog">
                      {verified
                        ? "Ed25519 quote valid · MRTD matches the agent allowlist"
                        : "Attestation failed on-chain — escrow refunded"}
                    </div>
                  </div>
                </div>
                {job.output_commitment && (
                  <div className="mt-4 rounded-2xl bg-carbon/60 p-3">
                    <div className="text-[11px] uppercase tracking-wider text-steel">Result commitment</div>
                    <div className="mt-1 font-mono text-xs text-mist">{short(job.output_commitment, 10)}</div>
                  </div>
                )}
                {verified && (
                  <div className="mt-4">
                    {result ? (
                      <div className="rounded-2xl border border-ash bg-onyx/60 p-4 text-sm text-mist whitespace-pre-wrap">
                        {result}
                      </div>
                    ) : revealErr ? (
                      <div className="rounded-2xl border border-ash bg-onyx/60 p-4">
                        <div className="text-sm text-fog">{revealErr}</div>
                        <p className="mt-2 text-xs text-steel">
                          The commitment above still proves what was produced — verification never
                          needs the plaintext.
                        </p>
                      </div>
                    ) : (
                      <PillButton variant="ghost" onClick={reveal}>
                        Reveal result (decrypt in browser)
                      </PillButton>
                    )}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action */}
        {!verified && !rejected && (
          <PillButton onClick={runEnclave} disabled={running} className="w-full">
            {running ? (
              <span className="flex items-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <HugeiconsIcon icon={Loading03Icon} size={16} />
                </motion.span>
                Verifying…
              </span>
            ) : (
              "Run in enclave → attest → verify"
            )}
          </PillButton>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>nonce {short(job.nonce)}</Badge>
          <Badge>input {short(job.input_commitment)}</Badge>
          <Badge>MRTD {short(job.expected_measurement)}</Badge>
        </div>
        {err && <p className="mt-3 text-xs text-reject">{err}</p>}
      </main>
    </>
  );
}

function Step({
  done,
  active,
  failed,
  label,
  note,
}: {
  done?: boolean;
  active?: boolean;
  failed?: boolean;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
          failed
            ? "border-reject text-reject"
            : done
            ? "border-verify bg-verify/20 text-verify"
            : active
            ? "border-pending text-pending"
            : "border-ash text-steel"
        }`}
      >
        {failed ? "✕" : done ? "✓" : active ? "…" : ""}
      </span>
      <span className={`text-sm ${done ? "text-mist" : "text-fog"}`}>{label}</span>
      {note && <span className="ml-auto text-xs text-fog">{note}</span>}
    </div>
  );
}
