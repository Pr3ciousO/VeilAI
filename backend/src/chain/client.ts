/**
 * Solana client for the deployed VeilAI program.
 *
 * The backend signs on behalf of both sides for the demo: the deployer wallet
 * stands in for the job creator (the app authenticates with Privy, which has no
 * funded devnet wallet), and the provider wallet is the agent operator. This is
 * custodial demo signing — the *verification* it drives is real, and the program
 * enforces the same rules regardless of who paid the fee.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import idl from "../idl/veilai.json" with { type: "json" };
import type { Veilai } from "../idl/veilai.js";
import { config } from "../config.js";

export const AGENT_SEED = Buffer.from("agent");
export const JOB_SEED = Buffer.from("job");
export const ESCROW_AUTH_SEED = Buffer.from("escrow-auth");

function loadKeypair(file: string): Keypair {
  const resolved = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolved, "utf-8"))));
}

export interface ChainClient {
  connection: Connection;
  program: Program<Veilai>;
  /** Stands in for the job creator (funds escrow). */
  creator: Keypair;
  /** The agent operator — signs execute_marker and verify_attestation. */
  provider: Keypair;
  usdcMint: PublicKey;
  agentPda: (authority: PublicKey) => PublicKey;
  jobPda: (creator: PublicKey, jobId: anchor.BN) => PublicKey;
  escrowAuthority: (jobPda: PublicKey) => PublicKey;
}

let cached: ChainClient | null = null;

/**
 * True when the backend has everything it needs to transact. When false the
 * API still works, but jobs are recorded off-chain only — and say so.
 */
export function chainEnabled(): boolean {
  return Boolean(
    config.programId &&
      config.usdcMint &&
      process.env.ANCHOR_WALLET &&
      process.env.PROVIDER_KEYPAIR,
  );
}

export function getChain(): ChainClient {
  if (cached) return cached;
  if (!chainEnabled()) {
    throw new Error(
      "Chain not configured — set VEILAI_PROGRAM_ID, USDC_MINT, ANCHOR_WALLET and PROVIDER_KEYPAIR",
    );
  }

  const connection = new Connection(config.baseRpc, "confirmed");
  const creator = loadKeypair(process.env.ANCHOR_WALLET!);
  const providerKp = loadKeypair(process.env.PROVIDER_KEYPAIR!);
  const wallet = new anchor.Wallet(creator);
  const anchorProvider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program<Veilai>(idl as Veilai, anchorProvider);

  cached = {
    connection,
    program,
    creator,
    provider: providerKp,
    usdcMint: new PublicKey(config.usdcMint),
    agentPda: (authority) =>
      PublicKey.findProgramAddressSync([AGENT_SEED, authority.toBuffer()], program.programId)[0],
    jobPda: (creatorKey, jobId) =>
      PublicKey.findProgramAddressSync(
        [JOB_SEED, creatorKey.toBuffer(), jobId.toArrayLike(Buffer, "le", 8)],
        program.programId,
      )[0],
    escrowAuthority: (job) =>
      PublicKey.findProgramAddressSync(
        [ESCROW_AUTH_SEED, job.toBuffer()],
        program.programId,
      )[0],
  };
  return cached;
}

/** Solana Explorer link for a signature or account, devnet-scoped. */
export function explorer(kind: "tx" | "address", value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}
