import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  JobStatus,
  AttestationStatus,
  verifyQuoteDetailed,
  commitString,
  newX25519Keypair,
  type SealedBox,
} from "@veilai/shared";
import { enclaveFromEnv } from "../enclave/stub.js";
import { chainEnabled } from "../chain/client.js";
import { createJobOnChain, verifyOnChain } from "../chain/lifecycle.js";

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

    // Put the job on-chain and escrow the budget. The row exists either way, so
    // a chain failure degrades to an off-chain-only job rather than losing it —
    // but the job then carries no proof, and `job_pda` stays null to say so.
    let job = data;
    if (chainEnabled()) {
      try {
        const oc = await createJobOnChain({
          jobId: body.jobId,
          agentAuthority: body.provider,
          promptCiphertextCommitment: body.promptCiphertextCommitment,
          inputCommitment: body.inputCommitment,
          nonce: body.nonce,
          budget: body.budget,
        });
        const { data: updated } = await db()
          .from("jobs")
          .update({
            status: JobStatus.Escrowed,
            job_pda: oc.jobPda,
            on_chain_creator: oc.onChainCreator,
            create_tx: oc.createSignature,
            escrow_tx: oc.escrowSignature,
          })
          .eq("id", body.id)
          .select()
          .single();
        if (updated) job = updated;
        await recordEvent(body.id, "escrowed", { jobPda: oc.jobPda }, oc.escrowSignature);
      } catch (e) {
        console.error("on-chain create failed:", (e as Error).message);
        await recordEvent(body.id, "chain_error", {
          step: "create",
          error: (e as Error).message,
        });
      }
    }
    res.status(201).json({ job });
  } catch (e) {
    next(e);
  }
});

/**
 * Execute the job inside the stub enclave: decrypt → infer → attest → verify
 * on-chain → settle or refund.
 *
 * `tamper: true` submits a different output commitment than the one the enclave
 * signed, simulating a provider that returns something other than what it ran.
 * The program catches it; this is the demo's rejection path.
 */
jobsRouter.post("/:id/execute", async (req, res, next) => {
  try {
    const userPublicKeyB58 = z.string().parse(req.body?.userPublicKey);
    const tamper = z.boolean().optional().parse(req.body?.tamper) ?? false;
    const { data: job, error } = await db().from("jobs").select("*").eq("id", req.params.id).single();
    if (error) throw error;

    await setStatus(job.id, JobStatus.Executing);
    await recordEvent(job.id, "executing");

    const modelId = job.model_id ?? "claude-opus-4-8";
    const out = await enclave.run({
      promptBox: job.prompt_ciphertext as SealedBox,
      userPublicKeyB58,
      modelId,
      nonce: job.nonce,
    });

    // What the provider *submits* — tampering swaps the real commitment for a
    // different one while keeping the enclave's signature over the real output.
    const submittedOutputCommitment = tamper
      ? commitString(`tampered:${out.outputCommitment}`)
      : out.outputCommitment;

    // The agent's registered quoting key is the allowlist — comparing the quote
    // against its own key would make this check vacuous.
    const { data: agent } = await db()
      .from("agents")
      .select("quoting_key")
      .eq("id", job.agent_id)
      .single();

    // Off-chain mirror, for the per-check UI breakdown. The verdict that decides
    // payment is the program's, below.
    const check = verifyQuoteDetailed(out.quote, {
      inputCommitment: out.inputCommitment,
      outputCommitment: submittedOutputCommitment,
      modelId,
      nonce: job.nonce,
      allowlistedQuotingKey: agent?.quoting_key ?? out.quote.quotingKey,
      expectedMeasurement: job.expected_measurement,
    });

    let verified = check.ok;
    let reason = check.reason ?? null;
    const chainUpdate: Record<string, unknown> = {};

    if (chainEnabled() && job.job_pda) {
      try {
        const verdict = await verifyOnChain({
          jobId: job.job_id,
          agentAuthority: job.provider,
          quote: out.quote,
          submittedOutputCommitment,
        });
        // The chain is authoritative — if it disagrees with the mirror, it wins.
        verified = verdict.verified;
        reason = verdict.reason ?? reason;
        chainUpdate.execute_tx = verdict.executeSignature;
        chainUpdate.verify_tx = verdict.verifySignature;
        chainUpdate.settlement_tx = verdict.settlementSignature;
        chainUpdate.on_chain_reason = verdict.reason;
        chainUpdate.settled = verdict.verified;
        await recordEvent(
          job.id,
          verdict.verified ? "verified" : "rejected",
          { onChain: true, reason: verdict.reason },
          verdict.verifySignature,
        );
        await recordEvent(
          job.id,
          verdict.verified ? "settled" : "refunded",
          { onChain: true },
          verdict.settlementSignature ?? undefined,
        );
      } catch (e) {
        console.error("on-chain verify failed:", (e as Error).message);
        await recordEvent(job.id, "chain_error", {
          step: "verify",
          error: (e as Error).message,
        });
      }
    } else {
      await recordEvent(job.id, verified ? "verified" : "rejected", { onChain: false, reason });
    }

    await db()
      .from("jobs")
      .update({
        output_commitment: submittedOutputCommitment,
        output_ciphertext: out.outputBox,
        // Recorded so a viewer can tell "sealed to a key I don't hold" apart
        // from "decryption failed" without attempting a doomed decrypt.
        output_recipient_pubkey: userPublicKeyB58,
        attestation_checks: check.checks,
        attestation_quote: out.quote,
        attestation_status: verified ? AttestationStatus.Verified : AttestationStatus.Rejected,
        status: verified
          ? chainUpdate.settled
            ? JobStatus.Settled
            : JobStatus.Verified
          : JobStatus.Rejected,
        ...chainUpdate,
      })
      .eq("id", job.id);

    res.json({
      ok: true,
      verified,
      reason,
      onChain: Boolean(chainUpdate.verify_tx),
      outputCommitment: submittedOutputCommitment,
      quote: out.quote,
    });
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

async function recordEvent(jobId: string, kind: string, detail?: unknown, signature?: string) {
  await db()
    .from("job_events")
    .insert({ job_id: jobId, kind, detail: detail ?? null, signature: signature ?? null });
}
