/**
 * The on-chain job lifecycle, driven from the API.
 *
 * create_job → deposit_escrow happen when a job is submitted; execute_marker →
 * verify_attestation → settle/refund happen when the enclave runs. The
 * attestation check that decides payment is the program's, not ours — the
 * backend's `verifyQuoteDetailed` is only a pre-flight mirror.
 */
import * as anchor from "@coral-xyz/anchor";
import { Ed25519Program, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { hexToBytes, quoteSignedMessage, type AttestationQuote } from "@veilai/shared";
import bs58 from "bs58";
import { getChain } from "./client.js";

const arr = (hex: string) => Array.from(hexToBytes(hex));

/**
 * register_agent. The platform wallet is the authority for marketplace-listed
 * agents (Privy users have no funded wallet), so `agent_id` is what separates
 * one listing from another under that single authority.
 */
export async function registerAgentOnChain(params: {
  agentId: number;
  modelId: string;
  configCommitment: string;
  measurement: string;
  quotingKeyB58: string;
  price: number;
}): Promise<{ agentPda: string; authority: string; signature: string }> {
  const chain = getChain();
  const authority = chain.provider.publicKey;
  const agentPda = chain.agentPda(authority, new anchor.BN(params.agentId));

  const signature = await chain.program.methods
    .registerAgent(
      new anchor.BN(params.agentId),
      params.modelId,
      arr(params.configCommitment),
      arr(params.measurement),
      Array.from(bs58.decode(params.quotingKeyB58)),
      new anchor.BN(params.price),
    )
    .accountsPartial({ agent: agentPda, authority })
    .signers([chain.provider])
    .rpc();

  return { agentPda: agentPda.toBase58(), authority: authority.toBase58(), signature };
}

export interface OnChainCreate {
  jobPda: string;
  onChainCreator: string;
  createSignature: string;
  escrowSignature: string;
}

/**
 * create_job + deposit_escrow. Returns the PDA and signatures so the job row
 * can point at real transactions.
 */
export async function createJobOnChain(params: {
  jobId: number;
  /** The agent's PDA, as recorded when it was registered. */
  agentPda: string;
  promptCiphertextCommitment: string;
  inputCommitment: string;
  nonce: string;
  budget: number;
}): Promise<OnChainCreate> {
  const chain = getChain();
  const jobId = new anchor.BN(params.jobId);
  const creator = chain.creator.publicKey;
  const jobPda = chain.jobPda(creator, jobId);
  const agentPda = new PublicKey(params.agentPda);

  const createSignature = await chain.program.methods
    .createJob(
      jobId,
      arr(params.promptCiphertextCommitment),
      arr(params.inputCommitment),
      arr(params.nonce),
      new anchor.BN(params.budget),
    )
    .accountsPartial({ job: jobPda, agent: agentPda, creator })
    .rpc();

  // The creator's ATA must exist and hold the budget; created here so a fresh
  // demo wallet doesn't fail on its first job.
  const creatorAta = (
    await getOrCreateAssociatedTokenAccount(
      chain.connection,
      chain.creator,
      chain.usdcMint,
      creator,
    )
  ).address;

  const escrowSignature = await chain.program.methods
    .depositEscrow()
    .accountsPartial({
      job: jobPda,
      creator,
      usdcMint: chain.usdcMint,
      creatorAta,
      escrowAuthority: chain.escrowAuthority(jobPda),
    })
    .rpc();

  return {
    jobPda: jobPda.toBase58(),
    onChainCreator: creator.toBase58(),
    createSignature,
    escrowSignature,
  };
}

export interface OnChainVerdict {
  /** The program's verdict — this is what decides payment. */
  verified: boolean;
  status: string;
  executeSignature: string;
  verifySignature: string;
  settlementSignature: string | null;
  /** On-chain rejection reason, parsed from the program log. */
  reason: string | null;
}

/**
 * execute_marker → verify_attestation → settle_payment_direct / refund_escrow_direct.
 *
 * `verify_attestation` does not fail the transaction on a bad quote — it records
 * `Rejected` — so the verdict is read back from the account, not from whether
 * the call threw.
 */
export async function verifyOnChain(params: {
  jobId: number;
  /** The agent's PDA, as recorded when it was registered. */
  agentPda: string;
  quote: AttestationQuote;
  /** Commitment the provider submits — differs from the signed one when tampered. */
  submittedOutputCommitment: string;
}): Promise<OnChainVerdict> {
  const chain = getChain();
  const jobId = new anchor.BN(params.jobId);
  const jobPda = chain.jobPda(chain.creator.publicKey, jobId);
  const agentPda = new PublicKey(params.agentPda);

  const executeSignature = await chain.program.methods
    .executeMarker()
    .accountsPartial({ job: jobPda, provider: chain.provider.publicKey })
    .signers([chain.provider])
    .rpc();

  // The Ed25519 precompile instruction must immediately precede the verify
  // instruction; the program reads it back at index 0 via sysvar introspection.
  const signature = hexToBytes(params.quote.signature);
  const mrtd = hexToBytes(params.quote.mrtd);
  // sha256(report_data ‖ mrtd) — recomputed identically on-chain.
  const signedMessage = Buffer.from(hexToBytes(quoteSignedMessage(params.quote)));
  const edIx = Ed25519Program.createInstructionWithPublicKey({
    publicKey: bs58.decode(params.quote.quotingKey),
    message: signedMessage,
    signature: Buffer.from(signature),
  });

  const verifySignature = await chain.program.methods
    .verifyAttestation(
      arr(params.submittedOutputCommitment),
      Array.from(mrtd),
      Array.from(signature),
      0,
    )
    .accountsPartial({
      job: jobPda,
      provider: chain.provider.publicKey,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .preInstructions([edIx])
    .signers([chain.provider])
    .rpc();

  const job = await chain.program.account.job.fetch(jobPda);
  const status = Object.keys(job.status)[0];
  const verified = status === "verified";
  const reason = verified ? null : await rejectionReason(verifySignature);

  // Money moves strictly on the program's verdict.
  const escrowAuthority = chain.escrowAuthority(jobPda);
  const escrowVault = getAssociatedTokenAddressSync(chain.usdcMint, escrowAuthority, true);
  let settlementSignature: string | null = null;

  if (verified) {
    const providerAta = (
      await getOrCreateAssociatedTokenAccount(
        chain.connection,
        chain.creator,
        chain.usdcMint,
        chain.provider.publicKey,
      )
    ).address;
    settlementSignature = await chain.program.methods
      .settlePaymentDirect()
      .accountsPartial({
        job: jobPda,
        agent: agentPda,
        authority: chain.provider.publicKey,
        usdcMint: chain.usdcMint,
        escrowAuthority,
        escrowVault,
        providerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([chain.provider])
      .rpc();
  } else {
    const creatorAta = getAssociatedTokenAddressSync(chain.usdcMint, chain.creator.publicKey);
    settlementSignature = await chain.program.methods
      .refundEscrowDirect()
      .accountsPartial({
        job: jobPda,
        agent: agentPda,
        authority: chain.creator.publicKey,
        usdcMint: chain.usdcMint,
        escrowAuthority,
        escrowVault,
        creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  return { verified, status, executeSignature, verifySignature, settlementSignature, reason };
}

/** Pull the program's rejection reason out of the transaction logs. */
async function rejectionReason(signature: string): Promise<string | null> {
  const chain = getChain();
  const tx = await chain.connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  const line = tx?.meta?.logMessages?.find((l) => l.includes("VeilAI: attestation REJECTED"));
  return line ? (line.split("—")[1]?.trim() ?? null) : null;
}
