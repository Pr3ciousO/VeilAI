/**
 * Off-chain backend smoke test: enclave pubkey → seal prompt → create job →
 * execute (decrypt → Claude inference → attest) → verify. Proves the demo path.
 * Requires the backend running on BACKEND_URL.
 */
import { sealTo, commitString, newX25519Keypair } from "@veilai/shared";
import crypto from "crypto";

const BASE = process.env.BACKEND_URL ?? "http://localhost:4000";
const hex = (n: number) => crypto.randomBytes(n).toString("hex");

async function j(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const { agents } = await j("/agents");
  if (!agents.length) throw new Error("no agents seeded");
  const agent = agents[0];
  console.log("→ agent:", agent.name, agent.id);

  const { x25519PublicKey } = await j("/jobs/enclave/pubkey");
  const prompt = "Summarize the three biggest risks in a SaaS company's Q4 financials in one sentence each.";
  const box = await sealTo(x25519PublicKey, new TextEncoder().encode(prompt));

  const jobId = Math.floor(Math.random() * 1_000_000_000);
  const id = `job_${jobId}`;
  await j("/jobs", {
    method: "POST",
    body: JSON.stringify({
      id, jobId, creator: "smoke-tester", agentId: agent.id, provider: agent.authority,
      title: "Smoke test", budget: 50_000,
      promptCiphertextCommitment: commitString(JSON.stringify(box)),
      inputCommitment: commitString(prompt),
      expectedMeasurement: agent.expected_measurement,
      nonce: hex(32), settlementId: hex(32), promptCiphertext: box,
    }),
  });
  console.log("→ created job", id);

  const user = newX25519Keypair();
  const res = await j(`/jobs/${id}/execute`, {
    method: "POST",
    body: JSON.stringify({ userPublicKey: user.publicB58 }),
  });
  console.log("→ execute:", JSON.stringify(res).slice(0, 160));
  if (!res.verified) throw new Error("job was not verified");
  console.log("\x1b[32m✓ SMOKE PASSED\x1b[0m — enclave decrypted, ran inference, attested, and verified.");
}

main().catch((e) => {
  console.error("\x1b[31mSMOKE FAILED:\x1b[0m", e.message ?? e);
  process.exit(1);
});
