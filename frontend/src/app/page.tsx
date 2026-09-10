"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { GlassCard, PillButton, Badge } from "@/components/ui";
import { CustomLogin } from "@/components/auth/CustomLogin";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldKeyIcon, CheckmarkBadge01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";

export default function Landing() {
  const { ready, authenticated } = usePrivy();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-snow" />
          <span className="text-lg font-semibold tracking-tight text-snow">VeilAI</span>
        </div>
        <Badge>Devnet · MagicBlock PER</Badge>
      </header>

      <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-snow md:text-6xl"
          >
            Private, verifiable execution for AI agents.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="max-w-md text-lg text-fog"
          >
            Submit sensitive jobs without exposing them on-chain. Providers must{" "}
            <span className="text-mist">prove execution</span> before they get paid.
          </motion.p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Feature icon={ShieldKeyIcon} label="Private in PER" />
            <Feature icon={CheckmarkBadge01Icon} label="Verified on-chain" />
            <Feature icon={Wallet01Icon} label="Proof before payment" />
          </div>
          <p className="pt-4 text-sm italic text-steel">Don&apos;t trust the agent. Verify it.</p>
        </div>

        <GlassCard className="w-full max-w-md justify-self-end p-8" raised>
          <h2 className="text-xl font-semibold text-snow">Get started</h2>
          <p className="mt-1 text-sm text-fog">Sign in to submit a confidential job.</p>
          <div className="mt-6">
            {!ready ? (
              <div className="h-40 animate-pulse rounded-2xl bg-carbon/60" />
            ) : authenticated ? (
              <Link href="/dashboard">
                <PillButton className="w-full">Enter dashboard →</PillButton>
              </Link>
            ) : (
              <CustomLogin />
            )}
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: typeof ShieldKeyIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-ash bg-carbon/50 px-3 py-1.5 text-xs text-mist">
      <HugeiconsIcon icon={icon} size={15} className="text-verify" />
      {label}
    </span>
  );
}
