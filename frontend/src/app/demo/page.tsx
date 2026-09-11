import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { GlassCard, PillButton, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Demo",
  description: "Watch VeilAI prove an AI agent ran the model you paid for — or refuse to pay it.",
};

/**
 * The stable link handed out on submissions.
 *
 * Set NEXT_PUBLIC_DEMO_URL to a walkthrough video and this becomes a redirect;
 * leave it unset and it stays a self-contained page. Either way the URL is
 * never dead, so the address can be published before the recording exists.
 */
export default function Demo() {
  const target = process.env.NEXT_PUBLIC_DEMO_URL;
  if (target) redirect(target);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Image
          src="/images/logos/logo-full-white-nobg.png"
          alt="VeilAI"
          width={128}
          height={34}
          priority
          className="h-8 w-auto"
        />
        <Badge>Solana devnet</Badge>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-8 py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-snow md:text-5xl">
            Private, verifiable execution infrastructure for AI agents.
          </h1>
          <p className="max-w-xl text-lg text-fog">
            Your task stays encrypted. The agent proves it ran — or it doesn&apos;t get paid.
          </p>
        </div>

        <GlassCard className="flex flex-col gap-5 p-8" raised>
          <div className="text-[11px] uppercase tracking-wider text-steel">Try it in two minutes</div>
          <ol className="flex flex-col gap-3 text-sm text-mist">
            <Step n={1}>
              Pick an agent. Its model and instructions are committed on-chain, so the one that runs
              your job is provably the one you chose.
            </Step>
            <Step n={2}>
              Submit a task. It&apos;s encrypted in your browser before it leaves, and the budget is
              escrowed in a program-owned vault.
            </Step>
            <Step n={3}>
              Run it. Four checks execute on-chain — quoting key, enclave measurement, report data,
              signature. All four pass, escrow releases.
            </Step>
            <Step n={4}>
              Then run one with <span className="text-reject">a tampered result</span>. One check
              goes red, the program rejects it, and the escrow refunds. Nobody reviews anything.
            </Step>
          </ol>
          <div className="flex flex-wrap gap-3 border-t border-ash pt-5">
            <Link href="/agents">
              <PillButton className="px-6 py-3">Open the marketplace →</PillButton>
            </Link>
            <Link href="/">
              <PillButton variant="outline" className="px-6 py-3">
                How it works
              </PillButton>
            </Link>
          </div>
        </GlassCard>

        <p className="text-xs leading-relaxed text-steel">
          Running on Solana devnet against program{" "}
          <span className="font-mono text-fog">86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT</span>.
          The enclave is a labelled stub: it produces a real ed25519 quote in the TDX field layout,
          and the on-chain verifier runs the genuine checks against it — including the measurement
          allowlist. Swapping it for real TDX changes zero on-chain code.
        </p>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ash text-[11px] text-fog">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
