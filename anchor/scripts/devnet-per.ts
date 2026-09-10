/**
 * Live PER delegation on MagicBlock devnet (the privacy layer):
 *   base: create_job (pre-funds permission rent) → delegate_job to the TEE validator
 *   ER:   init_permission → the Job state is now PRIVATE inside the TEE-backed rollup
 *
 * Run: pnpm --filter @veilai/anchor exec tsx scripts/devnet-per.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Veilai } from "../target/types/veilai";
import idl from "../target/idl/veilai.json";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
  getDelegationRecord,
  PERMISSION_PROGRAM_ID,
  PERMISSION_SEED,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as fs from "fs";
import * as crypto from "crypto";

const BASE_RPC = process.env.DEVNET_RPC ?? "https://api.devnet.solana.com";
const TEE_ER = process.env.TEE_ER ?? "https://devnet-tee-as.magicblock.app";
const TEE_VALIDATOR = new PublicKey("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");
const MODEL_ID = "claude-haiku-4-5";
const AGENT_SEED = Buffer.from("agent");
const JOB_SEED = Buffer.from("job");

const log = (s: string) => console.log(`\x1b[36m›\x1b[0m ${s}`);
const ok = (s: string) => console.log(`\x1b[32m✓\x1b[0m ${s}`);
const load = (p: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const base = new Connection(BASE_RPC, "confirmed");
  const er = new Connection(TEE_ER, "confirmed");
  const deployer = load("../wallets/deployer.keypair.json");
  const providerKp = load("../wallets/provider.keypair.json");
  const provider = new anchor.AnchorProvider(base, new anchor.Wallet(deployer), { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new Program<Veilai>(idl as Veilai, provider);
  const pid = program.programId;
  log(`program ${pid.toBase58()}`);
  log(`base ${BASE_RPC}  ·  TEE ER ${TEE_ER}`);

  const agentPda = PublicKey.findProgramAddressSync([AGENT_SEED, providerKp.publicKey.toBuffer()], pid)[0];
  await program.account.agent.fetch(agentPda); // must already be registered (from devnet:e2e)

  // 1. create_job on base — pre-funds the Job PDA for EphemeralPermission rent.
  const jobId = new anchor.BN(Math.floor(Math.random() * 1_000_000_000));
  const jobPda = PublicKey.findProgramAddressSync(
    [JOB_SEED, deployer.publicKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
    pid,
  )[0];
  log(`create_job #${jobId.toString()} (${jobPda.toBase58()})`);
  await program.methods
    .createJob(jobId, Array.from(crypto.randomBytes(32)), Array.from(crypto.randomBytes(32)), Array.from(crypto.randomBytes(32)), new anchor.BN(50_000))
    .accountsPartial({ job: jobPda, agent: agentPda, creator: deployer.publicKey })
    .rpc();
  ok("job created on base");

  // 2. delegate_job on base → delegate the Job PDA to the TEE validator.
  log("delegate_job → TEE validator…");
  await program.methods
    .delegateJob(jobId)
    .accountsPartial({
      creator: deployer.publicKey,
      bufferJob: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(jobPda, pid),
      delegationRecordJob: delegationRecordPdaFromDelegatedAccount(jobPda),
      delegationMetadataJob: delegationMetadataPdaFromDelegatedAccount(jobPda),
      job: jobPda,
      validator: TEE_VALIDATOR,
    })
    .rpc();
  ok("delegate tx confirmed on base");

  // 3. Confirm delegation: base owner → delegation program, and ER has the cloned account.
  log("confirming delegation…");
  let delegated = false;
  for (let i = 0; i < 30; i++) {
    const baseInfo = await base.getAccountInfo(jobPda);
    const erInfo = await er.getAccountInfo(jobPda);
    const baseOwnedByDelegation = baseInfo?.owner.toBase58() === "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";
    const erOwnedByProgram = erInfo?.owner.equals(pid) ?? false;
    if (baseOwnedByDelegation && erOwnedByProgram) {
      delegated = true;
      break;
    }
    await sleep(2000);
  }
  if (!delegated) throw new Error("delegation did not propagate to the TEE ER in time");
  const rec = await getDelegationRecord(base, jobPda).catch(() => null);
  ok(`delegated — base owner = delegation program, ER clone owned by veilai${rec ? ` (validator ${rec.authority?.toBase58?.() ?? "?"})` : ""}`);

  // 4. init_permission on the ER → make the Job state PRIVATE, gated to [creator, provider].
  const permission = PublicKey.findProgramAddressSync(
    [Buffer.from(PERMISSION_SEED), jobPda.toBuffer()],
    PERMISSION_PROGRAM_ID,
  )[0];
  const FULL = 1 | 2 | 4 | 8 | 16; // authority + all visibility flags
  const members = [
    { flags: FULL, pubkey: deployer.publicKey },
    { flags: FULL, pubkey: providerKp.publicKey },
  ];
  log("init_permission on the ER (EphemeralPermission, is_private=true)…");
  const ix = await program.methods
    .initPermission(members)
    .accountsPartial({
      creator: deployer.publicKey,
      job: jobPda,
      permission,
      permissionProgram: PERMISSION_PROGRAM_ID,
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  tx.feePayer = deployer.publicKey;
  tx.recentBlockhash = (await er.getLatestBlockhash()).blockhash;
  tx.sign(deployer);
  const sig = await er.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  await er.confirmTransaction(sig, "confirmed");
  ok(`permission created on the ER — sig ${sig.slice(0, 16)}…`);

  const permInfo = await er.getAccountInfo(permission);
  ok(`permission account live on ER (${permInfo?.data.length ?? 0} bytes, owner ${permInfo?.owner.toBase58().slice(0, 8)}…)`);

  console.log("\n\x1b[32m\x1b[1mLIVE PER DELEGATION COMPLETE\x1b[0m — Job state is delegated into the TEE-backed ER and gated by an EphemeralPermission. The prompt commitments now live in private ER state, not public base-layer state.");
}

main().catch((e) => {
  console.error("\x1b[31mPER FAILED:\x1b[0m", e);
  process.exit(1);
});
