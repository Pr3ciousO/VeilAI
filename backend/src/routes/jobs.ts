import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { JobStatus, AttestationStatus, verifyQuoteDetailed, type SealedBox } from "@veilai/shared";
import { enclaveFromEnv } from "../enclave/stub.js";
import { newX25519Keypair } from "@veilai/shared";

export const jobsRouter = Router();

// The enclave's x25519 keypair is process-local for the MVP. In production the
// secret lives only inside the TEE; the public key is published for clients to
// seal prompts against.
const enclaveKeypair = newX25519Keypair();
const enclave = enclaveFromEnv(enclaveKeypair.secret);

const SealedBoxSchema = z.object({ epk: z.string(), nonce: z.string(), ct: z.string() });

const CreateJob = z.object({
  id: z.string(), // job PDA (base58)
  jobId: z.number().int().nonnegative(),
  creator: z.string(),
  agentId: z.string(),
  provider: z.string(),
  title: z.string().optional(),
  budget: z.number().int().positive(),
  promptCiphertextCommitment: z.string(),
  inputCommitment: z.string(),
  expectedMeasurement: z.string(),
  nonce: z.string(),
  settlementId: z.string(),
  promptCiphertext: SealedBoxSchema, // sealed to the enclave key
});

/** Publish the enclave's x25519 public key so clients can seal prompts to it. */
jobsRouter.get("/enclave/pubkey", (_req, res) => {
  res.json({ x25519PublicKey: enclaveKeypair.publicB58 });
});

jobsRouter.get("/", async (req, res, next) => {
  try {
    let q = db().from("jobs").select("*").order("created_at", { ascending: false });
    if (typeof req.query.creator === "string") q = q.eq("creator", req.query.creator);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ jobs: data });
  } catch (e) {
    next(e);
  }
});

jobsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db().from("jobs").select("*").eq("id", req.params.id).single();
    if (error) throw error;
    res.json({ job: data });
  } catch (e) {
    next(e);
  }
});

jobsRouter.post("/", async (req, res, next) => {
  try {
    const body = CreateJob.parse(req.body);
    const { data, error } = await db()
      .from("jobs")
      .insert({
        id: body.id,
        job_id: body.jobId,
        creator: body.creator,
        agent_id: body.agentId,
        provider: body.provider,
        title: body.title ?? null,
        status: JobStatus.Created,
        attestation_status: AttestationStatus.None,
        budget: body.budget,
        prompt_ciphertext_commitment: body.promptCiphertextCommitment,
        input_commitment: body.inputCommitment,
        expected_measurement: body.expectedMeasurement,
        nonce: body.nonce,
        settlement_id: body.settlementId,
        prompt_ciphertext: body.promptCiphertext,
      })
      .select()
      .single();
    if (error) throw error;
    await recordEvent(body.id, "created");
    res.status(201).json({ job: data });
  } catch (e) {
    next(e);
  }
});

/**
 * Execute the job inside the stub enclave: decrypt → infer → attest.
 * Produces the attestation quote + sealed output and records them. The on-chain
 * `verify_attestation` + settlement submission is driven during devnet
 * integration (Phase 7); here we run the enclave and mirror the result.
 */
jobsRouter.post("/:id/execute", async (req, res, next) => {
  try {
    const userPublicKeyB58 = z.string().parse(req.body?.userPublicKey);
    const { data: job, error } = await db().from("jobs").select("*").eq("id", req.params.id).single();
    if (error) throw error;

    await setStatus(job.id, JobStatus.Executing);
    await recordEvent(job.id, "executing");

    const out = await enclave.run({
      promptBox: job.prompt_ciphertext as SealedBox,
      userPublicKeyB58,
      modelId: job.model_id ?? "claude-opus-4-8",
      nonce: job.nonce,
    });

    // Off-chain mirror of the on-chain verifier's checks (authoritative check is on-chain).
    const check = verifyQuoteDetailed(out.quote, {
      inputCommitment: out.inputCommitment,
      outputCommitment: out.outputCommitment,
      modelId: job.model_id ?? "claude-opus-4-8",
      nonce: job.nonce,
      allowlistedQuotingKey: out.quote.quotingKey,
      expectedMeasurement: job.expected_measurement,
    });

    const verified = check.ok;
    await db()
      .from("jobs")
      .update({
        output_commitment: out.outputCommitment,
        output_ciphertext: out.outputBox,
        // Recorded so a viewer can tell "sealed to a key I don't hold" apart
        // from "decryption failed" without attempting a doomed decrypt.
        output_recipient_pubkey: userPublicKeyB58,
        attestation_checks: check.checks,
        attestation_quote: out.quote,
        attestation_status: verified ? AttestationStatus.Verified : AttestationStatus.Rejected,
        status: verified ? JobStatus.Verified : JobStatus.Rejected,
      })
      .eq("id", job.id);
    await recordEvent(job.id, verified ? "verified" : "rejected", { reason: check.reason ?? null });

    res.json({ ok: true, verified, outputCommitment: out.outputCommitment, quote: out.quote });
  } catch (e) {
    next(e);
  }
});

jobsRouter.get("/:id/result", async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from("jobs")
      .select(
        "id, status, output_commitment, output_ciphertext, output_recipient_pubkey, attestation_checks, attestation_quote",
      )
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    res.json({ result: data });
  } catch (e) {
    next(e);
  }
});

async function setStatus(id: string, status: JobStatus) {
  await db().from("jobs").update({ status }).eq("id", id);
}

async function recordEvent(jobId: string, kind: string, detail?: unknown) {
  await db().from("job_events").insert({ job_id: jobId, kind, detail: detail ?? null });
}
