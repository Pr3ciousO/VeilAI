"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AppNav } from "@/components/AppNav";
import { GlassCard, PillButton, PillInput, GlassTextArea, Badge } from "@/components/ui";
import { api, type Agent } from "@/lib/api";
import { usdc } from "@/lib/format";
import { sealTo, commitString, commitJobInput } from "@veilai/shared";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { motion } from "framer-motion";

export default function CreateJob() {
  const router = useRouter();
  const { user } = usePrivy();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [task, setTask] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.agents().then((r) => {
      setAgents(r.agents);
      if (r.agents[0]) setAgentId(r.agents[0].id);
    }).catch((e) => setErr(e.message));
  }, []);

  const agent = agents.find((a) => a.id === agentId);

  async function onSubmit() {
    if (!agent) return;
    setErr(null);
    setBusy(true);
    try {
      // Seal the prompt to the enclave's x25519 key — plaintext never leaves the client unencrypted.
      const { x25519PublicKey } = await api.enclavePubkey();
      const box = await sealTo(x25519PublicKey, new TextEncoder().encode(task));
      const nonce = bytesToHex(randomBytes(32));
      const jobId = Math.floor(Math.random() * 1_000_000_000);
      const id = `job_${jobId}`;
      const creator = user?.id ?? "anon";

      await api.jobsCreate({
        id,
        jobId,
        creator,
        agentId: agent.id,
        provider: agent.authority,
        title: title || task.slice(0, 48),
        budget: Math.round(parseFloat(budget) * 1_000_000),
        promptCiphertextCommitment: commitString(JSON.stringify(box)),
        // Binds the chosen agent's definition into the attestation: if the
        // enclave runs a different config, report_data diverges on-chain.
        inputCommitment: commitJobInput({
          configCommitment: agent.config_commitment,
          prompt: task,
        }),
        expectedMeasurement: agent.expected_measurement,
        nonce,
        settlementId: nonce,
        promptCiphertext: box,
      });
      router.push(`/jobs/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-snow">Create a private job</h1>
        <p className="mt-1 text-sm text-fog">
          Your prompt is encrypted in this browser before it ever leaves — it never becomes public state.
        </p>

        <GlassCard className="mt-8 flex flex-col gap-6 p-8" raised>
          <Field label="Task" hint="Encrypted client-side to the enclave key">
            <GlassTextArea
              rows={5}
              placeholder="Analyze this financial report and identify the three largest cost increases…"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </Field>

          <Field label="Label (optional)" hint="Non-sensitive, for your dashboard">
            <PillInput placeholder="Q4 cost analysis" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Agent">
            {agents.length === 0 ? (
              <p className="text-sm text-fog">No agents registered yet.</p>
            ) : (
              <div className="grid gap-2">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAgentId(a.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                      agentId === a.id ? "border-verify/50 bg-verify/5" : "border-ash bg-carbon/50 hover:border-ferrite"
                    }`}
                  >
                    <div>
                      <div className="text-sm text-snow">{a.name}</div>
                      <div className="text-xs text-fog">{a.model_id}</div>
                    </div>
                    <Badge>{usdc(a.price)}</Badge>
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Budget (USDC)">
            <PillInput type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>

          <div className="flex items-center justify-between border-t border-ash pt-6">
            <Badge>🔒 Verification: hardware attestation</Badge>
            <PillButton onClick={onSubmit} disabled={!task || !agent || busy}>
              {busy ? "Encrypting…" : "Create private job"}
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
          The prompt is sealed with x25519 to the enclave. Only the attested enclave can open it.
        </motion.p>
      </main>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
