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
  name: string;
  description: string | null;
  model_id: string;
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
}

export interface SealedBoxDTO {
  epk: string;
  nonce: string;
  ct: string;
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
  jobs: (creator?: string) =>
    req<{ jobs: Job[] }>(`/jobs${creator ? `?creator=${creator}` : ""}`),
  job: (id: string) => req<{ job: Job }>(`/jobs/${id}`),
  jobsCreate: (body: CreateJobBody) =>
    req<{ job: Job }>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  enclavePubkey: () => req<{ x25519PublicKey: string }>("/jobs/enclave/pubkey"),
  execute: (id: string, userPublicKey: string) =>
    req<{ ok: boolean; verified: boolean; outputCommitment: string }>(
      `/jobs/${id}/execute`,
      { method: "POST", body: JSON.stringify({ userPublicKey }) },
    ),
  result: (id: string) =>
    req<{
      result: {
        id: string;
        status: string;
        output_commitment: string | null;
        output_ciphertext: SealedBoxDTO | null;
      };
    }>(`/jobs/${id}/result`),
};
