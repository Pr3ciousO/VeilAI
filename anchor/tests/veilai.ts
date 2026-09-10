import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veilai } from "../target/types/veilai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";

describe("veilai — phase 1 (job lifecycle)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.veilai as Program<Veilai>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // The same wallet acts as both provider (agent authority) and job creator here.
  const authority = wallet.payer;

  const AGENT_SEED = Buffer.from("agent");
  const JOB_SEED = Buffer.from("job");
  const ESCROW_AUTH_SEED = Buffer.from("escrow-auth");

  let usdcMint: PublicKey;
  let creatorAta: PublicKey;

  const modelId = "claude-haiku-4-5";
  const measurement = Array.from(crypto.randomBytes(48));
  const quotingKey = Array.from(crypto.randomBytes(32));
  const price = new anchor.BN(30_000); // 0.03 USDC (6 decimals)

  const jobId = new anchor.BN(Math.floor(Math.random() * 1_000_000));
  const budget = new anchor.BN(50_000); // 0.05 USDC
  const promptCommitment = Array.from(crypto.randomBytes(32));
  const inputCommitment = Array.from(crypto.randomBytes(32));
  const nonce = Array.from(crypto.randomBytes(32));

  const agentPda = PublicKey.findProgramAddressSync(
    [AGENT_SEED, authority.publicKey.toBuffer()],
    program.programId,
  )[0];

  const jobPda = PublicKey.findProgramAddressSync(
    [JOB_SEED, authority.publicKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    program.programId,
  )[0];

  const escrowAuthority = PublicKey.findProgramAddressSync(
    [ESCROW_AUTH_SEED, jobPda.toBuffer()],
    program.programId,
  )[0];

  before(async () => {
    // Local USDC-like mint (6 decimals) and a funded creator ATA.
    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      usdcMint,
      authority.publicKey,
    );
    creatorAta = ata.address;
    await mintTo(connection, authority, usdcMint, creatorAta, authority, 1_000_000);
  });

  it("registers an agent", async () => {
    await program.methods
      .registerAgent(modelId, measurement, quotingKey, price)
      .accounts({ authority: authority.publicKey })
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    assert.equal(agent.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(agent.modelId, modelId);
    assert.deepEqual(agent.expectedMeasurement, measurement);
    assert.deepEqual(agent.quotingKey, quotingKey);
    assert.equal(agent.reputation.toNumber(), 10_000);
  });

  it("creates a private job", async () => {
    await program.methods
      .createJob(jobId, promptCommitment, inputCommitment, nonce, budget)
      .accounts({
        job: jobPda,
        agent: agentPda,
        creator: authority.publicKey,
      })
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.equal(job.jobId.toString(), jobId.toString());
    assert.equal(job.creator.toBase58(), authority.publicKey.toBase58());
    assert.equal(job.agent.toBase58(), agentPda.toBase58());
    assert.deepEqual(job.status, { created: {} });
    assert.deepEqual(job.attestationStatus, { none: {} });
    assert.deepEqual(job.expectedMeasurement, measurement);
    assert.equal(job.modelId, modelId);
    assert.equal(job.budget.toString(), budget.toString());
  });

  it("deposits escrow and flips status to Escrowed", async () => {
    await program.methods
      .depositEscrow()
      .accounts({
        job: jobPda,
        creator: authority.publicKey,
        usdcMint,
        creatorAta,
        escrowAuthority,
      })
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { escrowed: {} });

    const vault = getAssociatedTokenAddressSync(usdcMint, escrowAuthority, true);
    const vaultAcct = await getAccount(connection, vault);
    assert.equal(vaultAcct.amount.toString(), budget.toString());
  });

  it("rejects a second escrow deposit (bad status)", async () => {
    try {
      await program.methods
        .depositEscrow()
        .accounts({
          job: jobPda,
          creator: authority.publicKey,
          usdcMint,
          creatorAta,
          escrowAuthority,
        })
        .rpc();
      assert.fail("expected BadStatus error");
    } catch (err: any) {
      assert.include(err.toString(), "BadStatus");
    }
  });

  it("rejects a job with zero budget (InvalidBudget)", async () => {
    const badJobId = new anchor.BN(Math.floor(Math.random() * 1_000_000) + 1_000_000);
    const badJobPda = PublicKey.findProgramAddressSync(
      [JOB_SEED, authority.publicKey.toBuffer(), badJobId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    )[0];
    try {
      await program.methods
        .createJob(badJobId, promptCommitment, inputCommitment, nonce, new anchor.BN(0))
        .accounts({
          job: badJobPda,
          agent: agentPda,
          creator: authority.publicKey,
        })
        .rpc();
      assert.fail("expected InvalidBudget error");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidBudget");
    }
  });
});
