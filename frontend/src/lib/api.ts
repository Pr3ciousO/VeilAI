const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface Agent {
  id: string;
  authority: string;
  agent_id: number | null;
  name: string;
  description: string | null;
  model_id: string;
  /** sha256 of the agent's definition; bound into every job it runs. */
  config_commitment: string;
  temperature: number;
  max_tokens: number;
  creator: string | null;
  register_tx: string | null;
  expected_measurement: string;
  quoting_key: string;
  price: number;
  capabilities: string[];
  completed: number;
  verified: number;
  rejected: number;
  reputation: number;
  avg_latency_ms: number | null;
}

export interface Job {
  id: string;
  job_id: number;
  creator: string;
  agent_id: string;
  provider: string;
  title: string | null;
  status: string;
  attestation_status: string;
  budget: number;
  output_commitment: string | null;
  input_commitment: string;
  expected_measurement: string;
  nonce: string;
  settled: boolean;
  created_at: string;
  /** Per-check verifier results; null until the job has been executed. */
  attestation_checks: AttestationCheckDTO[] | null;
  model_id: string | null;
  /** On-chain provenance; null when the job was recorded off-chain only. */
  job_pda: string | null;
  create_tx: string | null;
  escrow_tx: string | null;
  execute_tx: string | null;
  verify_tx: string | null;
  settlement_tx: string | null;
  on_chain_reason: string | null;
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddress(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

export interface AttestationCheckDTO {
  id: "quoting_key" | "measurement" | "report_data" | "signature";
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
  guards: string;
  reason: string;
}

export interface SealedBoxDTO {
  epk: string;
  nonce: string;
  ct: string;
}

export interface CreateAgentBody {
  name: string;
  description?: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  price: number;
  capabilities: string[];
  creator?: string;
}

export interface CreateJobBody {
  id: string;
  jobId: number;
  creator: string;
  agentId: string;
  provider: string;
  title?: string;
  budget: number;
  promptCiphertextCommitment: string;
  inputCommitment: string;
  expectedMeasurement: string;
  nonce: string;
  settlementId: string;
  promptCiphertext: SealedBoxDTO;
}

export const api = {
  health: () => req<{ status: string; db: boolean }>("/health"),
  agents: () => req<{ agents: Agent[] }>("/agents"),
  agent: (id: string) => req<{ agent: Agent }>(`/agents/${id}`),
  myAgents: (creator: string) => req<{ agents: Agent[] }>(`/agents?creator=${creator}`),
  agentsCreate: (body: CreateAgentBody) =>
    req<{ agent: Agent }>("/agents", { method: "POST", body: JSON.stringify(body) }),
  jobs: (creator?: string) =>
    req<{ jobs: Job[] }>(`/jobs${creator ? `?creator=${creator}` : ""}`),
  job: (id: string) => req<{ job: Job }>(`/jobs/${id}`),
  jobsCreate: (body: CreateJobBody) =>
    req<{ job: Job }>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  enclavePubkey: () => req<{ x25519PublicKey: string }>("/jobs/enclave/pubkey"),
  execute: (id: string, userPublicKey: string, tamper = false) =>
    req<{
      ok: boolean;
      verified: boolean;
      reason: string | null;
      onChain: boolean;
      outputCommitment: string;
    }>(`/jobs/${id}/execute`, {
      method: "POST",
      body: JSON.stringify({ userPublicKey, tamper }),
    }),
  result: (id: string) =>
    req<{
      result: {
        id: string;
        status: string;
        output_commitment: string | null;
        output_ciphertext: SealedBoxDTO | null;
        /** x25519 pubkey the output was sealed to; null for pre-migration rows. */
        output_recipient_pubkey: string | null;
      };
    }>(`/jobs/${id}/result`),
};
