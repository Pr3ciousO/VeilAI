import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veilai } from "../target/types/veilai";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";
import nacl from "tweetnacl";

const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest();
const cat = (...b: Buffer[]) => Buffer.concat(b);

describe("veilai — phase 4 (settlement)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.veilai as Program<Veilai>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const creator = wallet.payer;
  const providerKp = Keypair.generate();
  const quoting = nacl.sign.keyPair();
  const measurement = crypto.randomBytes(48);
  const modelId = "claude-haiku-4-5";
  const budget = new anchor.BN(50_000);

  const AGENT_SEED = Buffer.from("agent");
  const JOB_SEED = Buffer.from("job");
  const ESCROW_AUTH_SEED = Buffer.from("escrow-auth");

  let usdcMint: PublicKey;
  let creatorAta: PublicKey;
  let providerAta: PublicKey;

  const agentPda = PublicKey.findProgramAddressSync(
    [AGENT_SEED, providerKp.publicKey.toBuffer()],
    program.programId,
  )[0];

  before(async () => {
    const air = await connection.requestAirdrop(providerKp.publicKey, 2_000_000_000);
    await connection.confirmTransaction(air, "confirmed");

    usdcMint = await createMint(connection, creator, creator.publicKey, null, 6);
    creatorAta = (await getOrCreateAssociatedTokenAccount(connection, creator, usdcMint, creator.publicKey)).address;
    providerAta = (await getOrCreateAssociatedTokenAccount(connection, creator, usdcMint, providerKp.publicKey)).address;
    await mintTo(connection, creator, usdcMint, creatorAta, creator, 1_000_000);

    await program.methods
      .registerAgent(modelId, Array.from(measurement), Array.from(quoting.publicKey), new anchor.BN(30_000))
      .accountsPartial({ authority: providerKp.publicKey })
      .signers([providerKp])
      .rpc();
  });

  function pdas(jobId: anchor.BN) {
    const jobPda = PublicKey.findProgramAddressSync(
      [JOB_SEED, creator.publicKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    )[0];
    const escrowAuthority = PublicKey.findProgramAddressSync(
      [ESCROW_AUTH_SEED, jobPda.toBuffer()],
      program.programId,
    )[0];
    const escrowVault = getAssociatedTokenAddressSync(usdcMint, escrowAuthority, true);
    return { jobPda, escrowAuthority, escrowVault };
  }

  async function driveToExecuting(jobId: anchor.BN) {
    const { jobPda, escrowAuthority } = pdas(jobId);
    const input = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(32);
    await program.methods
      .createJob(jobId, Array.from(crypto.randomBytes(32)), Array.from(input), Array.from(nonce), budget)
      .accountsPartial({ job: jobPda, agent: agentPda, creator: creator.publicKey })
      .rpc();
    await program.methods
      .depositEscrow()
      .accountsPartial({ job: jobPda, creator: creator.publicKey, usdcMint, creatorAta, escrowAuthority })
      .rpc();
    await program.methods
      .executeMarker()
      .accountsPartial({ job: jobPda, provider: providerKp.publicKey })
      .signers([providerKp])
      .rpc();
    return { jobPda, input, nonce };
  }

  async function submitAttestation(jobPda: PublicKey, input: Buffer, nonce: Buffer, output: Buffer, mrtd: Buffer) {
    const rd = sha256(cat(input, output, Buffer.from(modelId, "utf8"), nonce));
    const msg = sha256(cat(rd, mrtd));
    const sig = Buffer.from(nacl.sign.detached(msg, quoting.secretKey));
    const edIx = Ed25519Program.createInstructionWithPublicKey({ publicKey: quoting.publicKey, message: msg, signature: sig });
    await program.methods
      .verifyAttestation(Array.from(output), Array.from(mrtd), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: providerKp.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .signers([providerKp])
      .rpc();
  }

  it("verified job → settle pays the provider", async () => {
    const jobId = new anchor.BN(Math.floor(Math.random() * 1e9));
    const { jobPda, input, nonce } = await driveToExecuting(jobId);
    const { escrowAuthority, escrowVault } = pdas(jobId);
    await submitAttestation(jobPda, input, nonce, crypto.randomBytes(32), measurement);

    const before = (await getAccount(connection, providerAta)).amount;

    await program.methods
      .settlePaymentDirect()
      .accountsPartial({
        job: jobPda,
        agent: agentPda,
        authority: providerKp.publicKey,
        usdcMint,
        escrowAuthority,
        escrowVault,
        providerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([providerKp])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { settled: {} });
    assert.equal(job.settled, true);

    const after = (await getAccount(connection, providerAta)).amount;
    assert.equal((after - before).toString(), budget.toString());

    const agent = await program.account.agent.fetch(agentPda);
    assert.isTrue(agent.completed.toNumber() >= 1);
    assert.isTrue(agent.verified.toNumber() >= 1);
  });

  it("rejected job → refund returns escrow to the creator", async () => {
    const jobId = new anchor.BN(Math.floor(Math.random() * 1e9));
    const { jobPda, input, nonce } = await driveToExecuting(jobId);
    const { escrowAuthority, escrowVault } = pdas(jobId);
    // Sign over the real output but submit a tampered one → Rejected.
    const realOutput = crypto.randomBytes(32);
    const rd = sha256(cat(input, realOutput, Buffer.from(modelId, "utf8"), nonce));
    const msg = sha256(cat(rd, measurement));
    const sig = Buffer.from(nacl.sign.detached(msg, quoting.secretKey));
    const edIx = Ed25519Program.createInstructionWithPublicKey({ publicKey: quoting.publicKey, message: msg, signature: sig });
    await program.methods
      .verifyAttestation(Array.from(crypto.randomBytes(32)), Array.from(measurement), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: providerKp.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .signers([providerKp])
      .rpc();

    let job = await program.account.job.fetch(jobPda);
    assert.deepEqual(job.status, { rejected: {} });

    const before = (await getAccount(connection, creatorAta)).amount;

    await program.methods
      .refundEscrowDirect()
      .accountsPartial({
        job: jobPda,
        agent: agentPda,
        authority: creator.publicKey,
        usdcMint,
        escrowAuthority,
        escrowVault,
        creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const after = (await getAccount(connection, creatorAta)).amount;
    assert.equal((after - before).toString(), budget.toString());

    job = await program.account.job.fetch(jobPda);
    assert.equal(job.settled, true);
    assert.deepEqual(job.status, { rejected: {} });
  });
});
