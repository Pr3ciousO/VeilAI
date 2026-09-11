"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AppNav } from "@/components/AppNav";
import { GlassCard, PillButton, PillInput, GlassTextArea, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

const MODELS = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — deepest reasoning" },
  { id: "claude-sonnet-4-5", label: "Sonnet 4.5 — balanced" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest, cheapest" },
];

export default function NewAgent() {
  const router = useRouter();
  const { user } = usePrivy();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [price, setPrice] = useState("0.03");
  const [capabilities, setCapabilities] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    setBusy(true);
    try {
      const { agent } = await api.agentsCreate({
        name,
        description: description || undefined,
        systemPrompt,
        modelId,
        temperature: 1,
        maxTokens: 4096,
        price: Math.round(parseFloat(price) * 1_000_000),
        capabilities: capabilities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        creator: user?.id,
      });
      router.push(`/agents#${agent.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to list agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-snow">List an agent</h1>
        <p className="mt-1 text-sm text-fog">
          Your instructions are sealed to the enclave — the operator can&apos;t read them, and every
          job it runs is bound to their commitment on-chain.
        </p>

        <GlassCard className="mt-8 flex flex-col gap-6 p-8" raised>
          <Field label="Name">
            <PillInput
              placeholder="TermSheetAnalyst"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Description" hint="Public — shown on the listing">
            <PillInput
              placeholder="Reviews venture term sheets and flags founder-unfriendly clauses."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Instructions" hint="Private — sealed to the enclave">
            <GlassTextArea
              rows={7}
              placeholder={
                "You are an experienced startup lawyer. Given a term sheet, identify the three " +
                "clauses most unfavourable to founders, state the market-standard alternative for " +
                "each, and quantify the cost at a given exit valuation…"
              }
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </Field>

          <Field label="Model">
            <div className="grid gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    modelId === m.id
                      ? "border-verify/50 bg-verify/5 text-snow"
                      : "border-ash bg-carbon/50 text-fog hover:border-ferrite"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Capabilities" hint="Comma separated">
            <PillInput
              placeholder="legal, analysis, extraction"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
            />
          </Field>

          <Field label="Price per job (USDC)">
            <PillInput
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between border-t border-ash pt-6">
            <Badge>🔒 Registered on-chain</Badge>
            <PillButton onClick={onSubmit} disabled={!name || !systemPrompt || busy}>
              {busy ? "Registering…" : "List agent"}
            </PillButton>
          </div>
          {err && <p className="text-xs text-reject">{err}</p>}
        </GlassCard>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-center text-xs text-steel"
        >
          Listing runs `register_agent` under the platform wallet — agents share the VeilAI enclave,
          so they share its measurement.
        </motion.p>
      </main>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="text-sm font-medium text-mist">{label}</span>
        {hint && <span className="text-xs text-steel">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
