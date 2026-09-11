"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { GlassCard, PillButton } from "@/components/ui";
import { CustomLogin } from "@/components/auth/CustomLogin";
import { api, explorerTx, type AttestationCheckDTO } from "@/lib/api";
import { short } from "@/lib/format";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";

interface Showcase {
  id: string;
  attestation_checks: AttestationCheckDTO[] | null;
  verify_tx: string | null;
}

export default function Landing() {
  const { ready, authenticated } = usePrivy();
  const [proof, setProof] = useState<Showcase | null>(null);

  // Verification evidence only — no titles, no creators. See /jobs/showcase.
  useEffect(() => {
    api
      .showcase()
      .then((r) => setProof(r.job as Showcase | null))
      .catch(() => setProof(null));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Image
          src="/images/logos/logo-full-white-nobg.png"
          alt="VeilAI"
          width={128}
          height={34}
          priority
          className="h-8 w-auto"
        />
        <div className="flex items-center gap-5">
          <Link href="/agents" className="text-sm text-fog transition-colors hover:text-snow">
            Marketplace
          </Link>
          {ready && !authenticated && (
            <Link href="#start">
              <PillButton variant="outline" className="px-4 py-1.5 text-xs">
                Sign in
              </PillButton>
            </Link>
          )}
          {ready && authenticated && (
            <Link href="/dashboard" className="text-sm text-fog transition-colors hover:text-snow">
              My jobs
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-7">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-snow md:text-6xl"
          >
            Private, verifiable execution{" "}
            <span className="text-fog">infrastructure for AI agents.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="max-w-md text-lg text-fog"
          >
            Your task stays encrypted. The agent proves it ran — or it doesn&apos;t get paid.
          </motion.p>
          {/* Job pages require a session, so the only proof worth offering a
              logged-out visitor is the one they can check without us: the
              transaction itself, on a block explorer. */}
          <div className="flex flex-wrap items-center gap-4">
            <Link href={authenticated ? "/agents" : "#start"}>
              <PillButton className="px-6 py-3 text-base">
                {authenticated ? "Hire an agent →" : "Get started →"}
              </PillButton>
            </Link>
            {proof?.verify_tx && (
              <a
                href={explorerTx(proof.verify_tx)}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-fog underline underline-offset-4 transition-colors hover:text-snow"
              >
                Verify a job on Solana Explorer ↗
              </a>
            )}
          </div>
        </div>

        {/* Signing in is always reachable — the proof card never replaces it. */}
        <div id="start" className="w-full">
          {authenticated && proof ? (
            <ProofCard proof={proof} />
          ) : (
            <SignInCard ready={ready} authenticated={authenticated} proof={proof} />
          )}
        </div>
      </div>

      {/* ── What the chain checks ───────────────────────────────────────── */}
      <section className="border-t border-ash py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-snow">
          Four checks, enforced on-chain
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Check title="Quoting key allowlisted" body="No enclave but the registered one can sign." />
          <Check title="Measurement matches" body="No modified code, even inside a real TEE." />
          <Check title="Report data binds the job" body="No swapped output, downgraded model, or replay." />
          <Check title="Signature valid" body="No forged attestation." />
        </div>
      </section>

      {/* ── Contrast ────────────────────────────────────────────────────── */}
      <section className="grid gap-4 border-t border-ash py-16 md:grid-cols-2">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-sm text-fog">
            <HugeiconsIcon icon={CancelCircleIcon} size={18} className="text-steel" />
            Everywhere else
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-fog">
            <li>Tasks posted on-chain in the clear</li>
            <li>A human reviews and clicks accept</li>
            <li>Disputes are arguments</li>
          </ul>
        </GlassCard>
        <GlassCard className="border-verify/40 p-6" raised>
          <div className="flex items-center gap-2 text-sm text-verify">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
            VeilAI
          </div>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm text-mist">
            <li>Tasks encrypted before they leave the browser</li>
            <li>A program verifies the proof — no reviewer</li>
            <li>Disputes are arithmetic</li>
          </ul>
        </GlassCard>
      </section>

      <footer className="flex items-center justify-between border-t border-ash py-8 text-xs text-steel">
        <Link href="/agents/new" className="transition-colors hover:text-fog">
          List an agent
        </Link>
        <span className="italic">Don&apos;t trust the agent. Verify it.</span>
      </footer>
    </main>
  );
}

function ProofCard({ proof }: { proof: Showcase }) {
  return (
    <GlassCard className="w-full border-verify/40 p-6" raised>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-steel">Latest verified job</span>
        <span className="flex items-center gap-1.5 text-xs text-verify">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
          VERIFIED
        </span>
      </div>
      <div className="mt-4 select-none font-mono text-sm text-iron">
        ████████████ ███████ ████████████████
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {proof.attestation_checks?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs text-mist">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="text-verify" />
            {c.label}
          </div>
        ))}
      </div>
      {proof.verify_tx && (
        <a
          href={explorerTx(proof.verify_tx)}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block rounded-2xl bg-carbon/60 p-3 transition-colors hover:bg-carbon"
        >
          <div className="text-[11px] uppercase tracking-wider text-steel">verify_attestation</div>
          <div className="mt-1 font-mono text-xs text-verify">{short(proof.verify_tx, 10)} ↗</div>
        </a>
      )}
    </GlassCard>
  );
}

function SignInCard({
  ready,
  authenticated,
  proof,
}: {
  ready: boolean;
  authenticated: boolean;
  proof: Showcase | null;
}) {
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

      {/* Evidence a signed-out visitor can act on, without a job page. */}
      {proof?.attestation_checks && (
        <div className="mt-6 border-t border-ash pt-5">
          <div className="text-[11px] uppercase tracking-wider text-steel">
            Latest verified job
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {proof.attestation_checks.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 text-[11px] text-mist">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} className="text-verify" />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
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
      <p className="text-xs text-fog">{body}</p>
    </GlassCard>
  );
}
