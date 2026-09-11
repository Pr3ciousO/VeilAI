/**
 * Devnet end-to-end: runs the full VeilAI lifecycle against the deployed program
 * on real Solana devnet — register → create → escrow → execute → verify → settle,
 * plus the INVALID path (tampered → rejected → refund).
 *
 * Uses a self-created SPL mint as stand-in USDC so no canonical-USDC funding is needed.
 * Run: pnpm --filter @veilai/anchor exec tsx scripts/devnet-e2e.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veilai } from "../target/types/veilai";
import idl from "../target/idl/veilai.json";
import {
  Connection,
  Keypair,
  PublicKey,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as crypto from "crypto";
import nacl from "tweetnacl";

const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest();
const cat = (...b: Buffer[]) => Buffer.concat(b);
const log = (s: string) => console.log(`\x1b[36m›\x1b[0m ${s}`);
const ok = (s: string) => console.log(`\x1b[32m✓\x1b[0m ${s}`);

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf-8"))));
}

const AGENT_SEED = Buffer.from("agent");
// Unique per authority — one wallet can list many agents.
const AGENT_ID = new anchor.BN(Math.floor(Math.random() * 1_000_000_000));
const JOB_SEED = Buffer.from("job");
const ESCROW_AUTH_SEED = Buffer.from("escrow-auth");
const MODEL_ID = "claude-haiku-4-5";

async function main() {
  const rpc = process.env.DEVNET_RPC ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const deployer = loadKeypair("../wallets/deployer.keypair.json");
  const providerKp = loadKeypair("../wallets/provider.keypair.json");
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new Program<Veilai>(idl as Veilai, provider);
  log(`program ${program.programId.toBase58()} @ ${rpc}`);

  // Stand-in USDC (6 decimals).
  log("creating test mint + ATAs…");
  const mint = await createMint(connection, deployer, deployer.publicKey, null, 6);
  const creatorAta = (await getOrCreateAssociatedTokenAccount(connection, deployer, mint, deployer.publicKey)).address;
  const providerAta = (await getOrCreateAssociatedTokenAccount(connection, deployer, mint, providerKp.publicKey)).address;
  await mintTo(connection, deployer, mint, creatorAta, deployer, 2_000_000);
  ok(`mint ${mint.toBase58()}`);

  // Real ed25519 quoting key + measurement.
  const quoting = nacl.sign.keyPair();
  const measurement = crypto.randomBytes(48);
  const configCommitment = crypto.randomBytes(32);

  const agentPda = PublicKey.findProgramAddressSync(
    [AGENT_SEED, providerKp.publicKey.toBuffer(), AGENT_ID.toArrayLike(Buffer, "le", 8)],
    program.programId,
  )[0];

  // register_agent (idempotent — ignore if already there)
  log("register_agent…");
  try {
    await program.methods
      .registerAgent(AGENT_ID, MODEL_ID, Array.from(configCommitment), Array.from(measurement), Array.from(quoting.publicKey), new anchor.BN(30_000))
      .accountsPartial({ authority: providerKp.publicKey })
      .signers([providerKp])
      .rpc();
    ok("agent registered");
  } catch (e) {
    // If already registered from a prior run, re-fetch its keys so signatures verify.
    ok(`agent already registered (${(e as Error).message.slice(0, 40)}…) — reusing`);
  }
  const agent = await program.account.agent.fetch(agentPda);
  // Use the on-chain agent's measurement/quoting key for signing.
  const agentMeasurement = Buffer.from(agent.expectedMeasurement);
  const quotingSecret = quoting.secretKey; // only valid if we just registered
  const registeredKey = Buffer.from(agent.quotingKey).toString("hex");
  if (registeredKey !== Buffer.from(quoting.publicKey).toString("hex")) {
    console.log("\x1b[33m!\x1b[0m agent was registered in a prior run with a different quoting key — run against a fresh provider wallet for a clean signature test.");
  }

  async function runJob(tamper: boolean) {
    const jobId = new anchor.BN(Math.floor(Math.random() * 1_000_000_000));
    const jobPda = PublicKey.findProgramAddressSync(
      [JOB_SEED, deployer.publicKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    )[0];
    const escrowAuthority = PublicKey.findProgramAddressSync([ESCROW_AUTH_SEED, jobPda.toBuffer()], program.programId)[0];
    const escrowVault = getAssociatedTokenAddressSync(mint, escrowAuthority, true);
    const input = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(32);
    const budget = new anchor.BN(50_000);

    log(`create_job #${jobId.toString()}…`);
    await program.methods
      .createJob(jobId, Array.from(crypto.randomBytes(32)), Array.from(input), Array.from(nonce), budget)
      .accountsPartial({ job: jobPda, agent: agentPda, creator: deployer.publicKey })
      .rpc();

    log("deposit_escrow…");
    await program.methods
      .depositEscrow()
      .accountsPartial({ job: jobPda, creator: deployer.publicKey, usdcMint: mint, creatorAta, escrowAuthority })
      .rpc();

    log("execute_marker…");
    await program.methods
      .executeMarker()
      .accountsPartial({ job: jobPda, provider: providerKp.publicKey })
      .signers([providerKp])
      .rpc();

    // Build the attestation. Sign over the real output; optionally submit a tampered one.
    const realOutput = crypto.randomBytes(32);
    const submittedOutput = tamper ? crypto.randomBytes(32) : realOutput;
    const rd = sha256(cat(input, realOutput, Buffer.from(MODEL_ID, "utf8"), nonce));
    const msg = sha256(cat(rd, agentMeasurement));
    const sig = Buffer.from(nacl.sign.detached(msg, quotingSecret));
    const edIx = Ed25519Program.createInstructionWithPublicKey({
      publicKey: Buffer.from(agent.quotingKey),
      message: msg,
      signature: sig,
    });

    log(`verify_attestation (${tamper ? "TAMPERED" : "valid"})…`);
    await program.methods
      .verifyAttestation(Array.from(submittedOutput), Array.from(agentMeasurement), Array.from(sig), 0)
      .accountsPartial({ job: jobPda, provider: providerKp.publicKey, instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY })
      .preInstructions([edIx])
      .signers([providerKp])
      .rpc();

    const job = await program.account.job.fetch(jobPda);
    const status = Object.keys(job.status)[0];
    if (tamper) {
      if (status !== "rejected") throw new Error(`expected rejected, got ${status}`);
      ok("attestation REJECTED (as expected)");
      const before = (await getAccount(connection, creatorAta)).amount;
      log("refund_escrow_direct…");
      await program.methods
        .refundEscrowDirect()
        .accountsPartial({
          job: jobPda, agent: agentPda, authority: deployer.publicKey,
          usdcMint: mint, escrowAuthority, escrowVault, creatorAta, tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      const after = (await getAccount(connection, creatorAta)).amount;
      ok(`refunded ${(after - before).toString()} to creator`);
    } else {
      if (status !== "verified") throw new Error(`expected verified, got ${status}`);
      ok("attestation VERIFIED (quote + measurement)");
      const before = (await getAccount(connection, providerAta)).amount;
      log("settle_payment_direct…");
      await program.methods
        .settlePaymentDirect()
        .accountsPartial({
          job: jobPda, agent: agentPda, authority: providerKp.publicKey,
          usdcMint: mint, escrowAuthority, escrowVault, providerAta, tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([providerKp])
        .rpc();
      const after = (await getAccount(connection, providerAta)).amount;
      ok(`settled ${(after - before).toString()} to provider`);
    }
  }

  console.log("\n\x1b[1m— Happy path —\x1b[0m");
  await runJob(false);
  console.log("\n\x1b[1m— INVALID path (the demo money-shot) —\x1b[0m");
  await runJob(true);

  console.log("\n\x1b[32m\x1b[1mDEVNET E2E COMPLETE\x1b[0m — verified→paid and tampered→rejected→refunded, on real devnet.");
}

main().catch((e) => {
  console.error("\x1b[31mE2E FAILED:\x1b[0m", e);
  process.exit(1);
});
