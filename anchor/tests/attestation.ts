import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veilai } from "../target/types/veilai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  PublicKey,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";
import nacl from "tweetnacl";

const sha256 = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest();
const cat = (...bufs: Buffer[]) => Buffer.concat(bufs);

describe("veilai — phase 3 (attestation verification)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.veilai as Program<Veilai>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;
  const authority = wallet.payer; // provider (agent authority) == creator here

  const AGENT_SEED = Buffer.from("agent");
  // Unique per authority — one wallet can list many agents.
  const AGENT_ID = new anchor.BN(Math.floor(Math.random() * 1_000_000_000));
  const JOB_SEED = Buffer.from("job");
  const ESCROW_AUTH_SEED = Buffer.from("escrow-auth");

  const modelId = "claude-haiku-4-5";
  // Real ed25519 quoting keypair (stands in for the TEE quoting key).
  const quoting = nacl.sign.keyPair();
  const measurement = crypto.randomBytes(48);
  const configCommitment = crypto.randomBytes(32);

  let usdcMint: PublicKey;
  let creatorAta: PublicKey;

  const agentPda = PublicKey.findProgramAddressSync(
    [AGENT_SEED, authority.publicKey.toBuffer(), AGENT_ID.toArrayLike(Buffer, "le", 8)],
    program.programId,
  )[0];

  before(async () => {
    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, authority.publicKey);
    creatorAta = ata.address;
    await mintTo(connection, authority, usdcMint, creatorAta, authority, 5_000_000);

    // Register the agent with the real quoting key + measurement.
    await program.methods
      .registerAgent(
        AGENT_ID,
        modelId,
        Array.from(configCommitment),
        Array.from(measurement),
        Array.from(quoting.publicKey),
        new anchor.BN(30_000),
      )
      .accountsPartial({ authority: authority.publicKey })
      .rpc()
      .catch(() => {}); // idempotent across suites sharing the wallet
  });

  // Drive a job to Executing, returning its handles + commitments.
  async function makeExecutingJob() {
    const jobId = new anchor.BN(Math.floor(Math.random() * 1_000_000_000));
    const jobPda = PublicKey.findProgramAddressSync(
      [JOB_SEED, authority.publicKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    )[0];
    const escrowAuthority = PublicKey.findProgramAddressSync(
      [ESCROW_AUTH_SEED, jobPda.toBuffer()],
      program.programId,
    )[0];

    const inputCommitment = crypto.randomBytes(32);
    const promptCommitment = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(32);

    await program.methods
      .createJob(jobId, Array.from(promptCommitment), Array.from(inputCommitment), Array.from(nonce), new anchor.BN(50_000))
      .accountsPartial({ job: jobPda, agent: agentPda, creator: authority.publicKey })
      .rpc();

    await program.methods
      .depositEscrow()
      .accountsPartial({ job: jobPda, creator: authority.publicKey, usdcMint, creatorAta, escrowAuthority })
      .rpc();

    await program.methods
      .executeMarker()
      .accountsPartial({ job: jobPda, provider: authority.publicKey })
      .rpc();

    return { jobId, jobPda, inputCommitment, nonce };
  }

  function reportData(input: Buffer, output: Buffer, nonce: Buffer) {
    return sha256(cat(input, output, Buffer.from(modelId, "utf8"), nonce));
  }
  function signedMessage(rd: Buffer, mrtd: Buffer) {
    return sha256(cat(rd, mrtd));
  }

  it("verifies a valid attestation → Verified", async () => {
    const { jobPda, inputCommitment, nonce } = await makeExecutingJob();
    const output = crypto.randomBytes(32);

    const rd = reportData(inputCommitment, output, nonce);
    const msg = signedMessage(rd, measurement);
    const sig = Buffer.from(nacl.sign.detached(msg, quoting.secretKey));

    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: quoting.publicKey,
      message: msg,
      signature: sig,
    });

    await program.methods
      .verifyAttestation(Array.from(output), Array.from(measurement), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: authority.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { verified: {} });
    assert.deepEqual(job.attestationStatus, { verified: {} });
    assert.deepEqual(Array.from(job.outputCommitment), Array.from(output));
  });

  it("rejects a tampered output (signature was over a different result) → Rejected", async () => {
    const { jobPda, inputCommitment, nonce } = await makeExecutingJob();
    const realOutput = crypto.randomBytes(32);
    const tamperedOutput = crypto.randomBytes(32);

    // Enclave signs over the REAL output; provider submits a different one.
    const rd = reportData(inputCommitment, realOutput, nonce);
    const msg = signedMessage(rd, measurement);
    const sig = Buffer.from(nacl.sign.detached(msg, quoting.secretKey));

    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: quoting.publicKey,
      message: msg, // valid signature (precompile passes) but binds realOutput
      signature: sig,
    });

    await program.methods
      .verifyAttestation(Array.from(tamperedOutput), Array.from(measurement), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: authority.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { rejected: {} });
    assert.deepEqual(job.attestationStatus, { rejected: {} });
  });

  it("rejects a non-allowlisted measurement → Rejected", async () => {
    const { jobPda, inputCommitment, nonce } = await makeExecutingJob();
    const output = crypto.randomBytes(32);
    const wrongMeasurement = crypto.randomBytes(48);

    // Sign correctly over the wrong measurement so the precompile passes.
    const rd = reportData(inputCommitment, output, nonce);
    const msg = signedMessage(rd, wrongMeasurement);
    const sig = Buffer.from(nacl.sign.detached(msg, quoting.secretKey));

    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: quoting.publicKey,
      message: msg,
      signature: sig,
    });

    await program.methods
      .verifyAttestation(Array.from(output), Array.from(wrongMeasurement), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: authority.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { rejected: {} });
  });
});
