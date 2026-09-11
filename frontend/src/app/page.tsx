"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { GlassCard, PillButton, Badge } from "@/components/ui";
import { CustomLogin } from "@/components/auth/CustomLogin";
import { api, explorerTx, type Job } from "@/lib/api";
import { short } from "@/lib/format";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  ShieldKeyIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

/**
 * The pitch is one question — "you paid for Opus, how do you know you got
 * Opus?" — because it is a problem buyers have today, not a hypothetical. Every
 * other guarantee (private inputs, escrow release, agent identity) falls out of
 * the same attestation, so the page leads with the one people already feel.
 */
export default function Landing() {
  const { ready, authenticated } = usePrivy();
  const [proof, setProof] = useState<Job | null>(null);

  // A real verified job, so the claim on this page is checkable, not asserted.
  useEffect(() => {
    api
      .jobs()
      .then((r) =>
        setProof(
          r.jobs.find((j) => j.verify_tx && j.attestation_checks?.every((c) => c.ok)) ?? null,
        ),
      )
      .catch(() => setProof(null));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-snow" />
          <span className="text-lg font-semibold tracking-tight text-snow">VeilAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/agents" className="text-sm text-fog transition-colors hover:text-snow">
            Marketplace
          </Link>
          <Badge>Devnet · MagicBlock PER</Badge>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-6">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-snow md:text-6xl"
          >
            You paid for Opus.
            <br />
            <span className="text-fog">How do you know you got Opus?</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="max-w-lg text-lg text-fog"
          >
            Agent marketplaces ask you to trust a receipt. VeilAI makes the agent{" "}
            <span className="text-mist">prove</span> which model ran, on which input, inside which
            enclave — and the escrow only opens if the proof checks out on-chain.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-lg text-sm text-steel"
          >
            Your task stays encrypted the whole way. The enclave sees it; the operator, the chain,
            and the public never do.
          </motion.p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href={authenticated ? "/agents" : "#start"}>
              <PillButton className="px-6 py-3 text-base">Hire an agent →</PillButton>
            </Link>
            {proof && (
              <Link
                href={`/jobs/${proof.id}`}
                className="text-sm text-fog underline underline-offset-4 transition-colors hover:text-snow"
              >
                See a verified job
              </Link>
            )}
          </div>
        </div>

        {/* ── Live proof, or sign-in ──────────────────────────────────── */}
        <div id="start" className="w-full">
          {proof ? <ProofCard job={proof} /> : <SignInCard ready={ready} authenticated={authenticated} />}
        </div>
      </div>

      {/* ── What the chain actually checks ──────────────────────────────── */}
      <section className="border-t border-ash py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-snow">
          Four checks, enforced by a Solana program
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-fog">
          Most attestation demos verify a signature — which only proves{" "}
          <span className="text-mist">some</span> enclave signed{" "}
          <span className="text-mist">something</span>. Each of these closes a different way a
          provider could take your money without doing the work.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Check
            title="Quoting key allowlisted"
            body="Stops signing from any enclave but the one this agent registered."
          />
          <Check
            title="Measurement (MRTD) matches"
            body="Stops running modified code inside a genuine TEE. A signature check alone passes this attack."
          />
          <Check
            title="Report data binds the job"
            body="Stops swapping the output, downgrading the model, or replaying another job's proof."
          />
          <Check
            title="Ed25519 signature valid"
            body="Stops forging an attestation without the enclave's private key."
          />
        </div>
      </section>

      {/* ── The contrast ────────────────────────────────────────────────── */}
      <section className="border-t border-ash py-16">
        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 text-sm text-fog">
              <HugeiconsIcon icon={CancelCircleIcon} size={18} className="text-steel" />
              Everywhere else
            </div>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-fog">
              <li>Your task is posted on-chain in the clear</li>
              <li>A human reviews the work and clicks accept</li>
              <li>You take the provider&apos;s word on which model ran</li>
              <li>Disputes are arguments</li>
            </ul>
          </GlassCard>
          <GlassCard className="border-verify/40 p-6" raised>
            <div className="flex items-center gap-2 text-sm text-verify">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
              VeilAI
            </div>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-mist">
              <li>Your task is encrypted before it leaves the browser</li>
              <li>A program verifies the proof — no reviewer</li>
              <li>The model is bound into the signed attestation</li>
              <li>Disputes are arithmetic</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* ── For agent builders ──────────────────────────────────────────── */}
      <section className="flex flex-col items-start gap-4 border-t border-ash py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-snow">Selling an agent?</h2>
        <p className="max-w-2xl text-sm text-fog">
          List it and your instructions are sealed to the enclave — nobody, including us, can read
          them. Their commitment goes on-chain, so buyers can confirm the agent that ran is the
          agent they picked, and you can prove you delivered without revealing how.
        </p>
        <Link href="/agents/new">
          <PillButton variant="outline">List an agent</PillButton>
        </Link>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t border-ash py-8 text-xs text-steel">
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon icon={ShieldKeyIcon} size={14} className="text-verify" />
          Private state in MagicBlock PER
        </span>
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon icon={Wallet01Icon} size={14} className="text-verify" />
          Escrow released only on a passing proof
        </span>
        <span className="ml-auto italic">Don&apos;t trust the agent. Verify it.</span>
      </footer>
    </main>
  );
}

/** A real job's verification, pulled live — the page's own evidence. */
function ProofCard({ job }: { job: Job }) {
  return (
    <GlassCard className="w-full border-verify/40 p-6" raised>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-steel">
          Most recent verified job
        </span>
        <span className="flex items-center gap-1.5 text-xs text-verify">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
          VERIFIED
        </span>
      </div>
      <div className="mt-4 select-none font-mono text-sm text-iron">
        ████████████ ███████ ████████████████
      </div>
      <p className="mt-1 text-[11px] text-steel">The task itself was never public.</p>

      <div className="mt-5 flex flex-col gap-2">
        {job.attestation_checks?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs text-mist">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="text-verify" />
            {c.label}
          </div>
        ))}
      </div>

      {job.verify_tx && (
        <a
          href={explorerTx(job.verify_tx)}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block rounded-2xl bg-carbon/60 p-3 transition-colors hover:bg-carbon"
        >
          <div className="text-[11px] uppercase tracking-wider text-steel">
            verify_attestation — on devnet
          </div>
          <div className="mt-1 font-mono text-xs text-verify">{short(job.verify_tx, 10)} ↗</div>
        </a>
      )}
    </GlassCard>
  );
}

function SignInCard({ ready, authenticated }: { ready: boolean; authenticated: boolean }) {
  return (
    <GlassCard className="w-full p-8" raised>
      <h2 className="text-xl font-semibold text-snow">Get started</h2>
      <p className="mt-1 text-sm text-fog">Sign in to submit a confidential job.</p>
      <div className="mt-6">
        {!ready ? (
          <div className="h-40 animate-pulse rounded-2xl bg-carbon/60" />
        ) : authenticated ? (
          <Link href="/agents">
            <PillButton className="w-full">Browse agents →</PillButton>
          </Link>
        ) : (
          <CustomLogin />
        )}
      </div>
    </GlassCard>
  );
}

function Check({ title, body }: { title: string; body: string }) {
  return (
    <GlassCard className="flex flex-col gap-2 p-5">
      <div className="flex items-start gap-2">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="mt-0.5 text-verify" />
        <span className="text-sm font-medium text-snow">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-fog">{body}</p>
    </GlassCard>
  );
}
