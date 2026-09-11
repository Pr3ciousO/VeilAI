/**
 * One-time devnet setup so the API can transact:
 *
 *   1. ensure a stand-in USDC mint exists and the creator wallet holds a balance
 *   2. register the agent on-chain with the *running enclave's* quoting key and
 *      measurement — if these don't match, every attestation is correctly
 *      rejected, so this is the step that makes honest jobs verifiable
 *   3. mirror the on-chain agent into Supabase
 *
 * Run: pnpm --filter @veilai/backend chain:bootstrap
 */
import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { edPublicFromSecret, hexToBytes } from "@veilai/shared";
import bs58 from "bs58";
import { getChain, chainEnabled, explorer } from "./client.js";
import { config } from "../config.js";
import { db } from "../db/client.js";

const MINT_AMOUNT = 50_000_000; // 50 stand-in USDC, enough for a long demo

async function main() {
  if (!chainEnabled()) {
    throw new Error(
      "Chain not configured — set VEILAI_PROGRAM_ID, USDC_MINT, ANCHOR_WALLET, PROVIDER_KEYPAIR",
    );
  }
  if (!config.enclaveQuotingSecret || !config.enclaveMeasurement) {
    throw new Error("Set ENCLAVE_QUOTING_SECRET and ENCLAVE_MEASUREMENT");
  }

  const chain = getChain();
  console.log(`› program ${chain.program.programId.toBase58()} @ ${config.baseRpc}`);
  console.log(`› creator ${chain.creator.publicKey.toBase58()}`);
  console.log(`› provider ${chain.provider.publicKey.toBase58()}`);

  const balance = await chain.connection.getBalance(chain.creator.publicKey);
  if (balance === 0) throw new Error("Creator wallet has no SOL — airdrop devnet SOL first");

  // ─── 1. Stand-in USDC ────────────────────────────────────────────────
  let mint = chain.usdcMint;
  const mintInfo = await chain.connection.getAccountInfo(mint);
  if (!mintInfo) {
    console.log("› configured USDC_MINT does not exist — creating a stand-in mint…");
    mint = await createMint(
      chain.connection,
      chain.creator,
      chain.creator.publicKey,
      null,
      6,
    );
    console.log(`\n  Put this in backend/.env:\n    USDC_MINT=${mint.toBase58()}\n`);
  }

  const creatorAta = await getOrCreateAssociatedTokenAccount(
    chain.connection,
    chain.creator,
    mint,
    chain.creator.publicKey,
  );
  await getOrCreateAssociatedTokenAccount(
    chain.connection,
    chain.creator,
    mint,
    chain.provider.publicKey,
  );

  const held = (await getAccount(chain.connection, creatorAta.address)).amount;
  if (held < BigInt(1_000_000)) {
    try {
      await mintTo(chain.connection, chain.creator, mint, creatorAta.address, chain.creator, MINT_AMOUNT);
      console.log(`✓ minted ${MINT_AMOUNT / 1e6} stand-in USDC to creator`);
    } catch {
      console.log("! could not mint — creator is not the mint authority; fund the ATA manually");
    }
  } else {
    console.log(`✓ creator holds ${Number(held) / 1e6} USDC`);
  }

  // ─── 2. Register the agent with the running enclave's identity ───────
  const quotingKeyB58 = edPublicFromSecret(hexToBytes(config.enclaveQuotingSecret));
  const quotingKey = Array.from(bs58.decode(quotingKeyB58));
  const measurement = Array.from(hexToBytes(config.enclaveMeasurement));
  const modelId = process.env.AGENT_MODEL_ID ?? "claude-opus-4-8";
  const price = Number(process.env.AGENT_PRICE ?? 30_000);
  const agentPda = chain.agentPda(chain.provider.publicKey);

  const existing = await chain.connection.getAccountInfo(agentPda);
  if (existing) {
    const agent = await chain.program.account.agent.fetch(agentPda);
    const onChainKey = bs58.encode(Buffer.from(agent.quotingKey));
    const onChainMrtd = Buffer.from(agent.expectedMeasurement).toString("hex");
    const keyMatches = onChainKey === quotingKeyB58;
    const mrtdMatches = onChainMrtd === config.enclaveMeasurement.toLowerCase();
    if (keyMatches && mrtdMatches) {
      console.log("✓ agent already registered and matches this enclave");
    } else {
      // register_agent uses `init`, so a mismatched agent cannot be updated —
      // it would verify every honest job as Rejected. Fail loudly.
      console.error("\n✗ On-chain agent does NOT match the running enclave:");
      if (!keyMatches) console.error(`    quoting key  on-chain ${onChainKey}\n                 enclave  ${quotingKeyB58}`);
      if (!mrtdMatches) console.error(`    measurement  on-chain ${onChainMrtd}\n                 enclave  ${config.enclaveMeasurement}`);
      console.error(
        "\n  Every attestation will be rejected. Either point ENCLAVE_QUOTING_SECRET/" +
          "ENCLAVE_MEASUREMENT at the registered values, or use a fresh provider keypair.\n",
      );
      process.exit(1);
    }
  } else {
    const sig = await chain.program.methods
      .registerAgent(modelId, measurement, quotingKey, new anchor.BN(price))
      .accountsPartial({ authority: chain.provider.publicKey })
      .signers([chain.provider])
      .rpc();
    console.log(`✓ agent registered — ${explorer("tx", sig)}`);
  }

  // ─── 3. Mirror into Supabase so /agents lists the real on-chain agent ─
  const { error } = await db()
    .from("agents")
    .upsert({
      id: agentPda.toBase58(),
      authority: chain.provider.publicKey.toBase58(),
      name: process.env.AGENT_NAME ?? "ResearchBot",
      description: "Research & document analysis — summarization, extraction, classification.",
      model_id: modelId,
      expected_measurement: config.enclaveMeasurement,
      quoting_key: quotingKeyB58,
      price,
      capabilities: ["research", "summarization", "extraction", "classification"],
    });
  if (error) throw error;

  console.log(`✓ agent mirrored to Supabase — ${explorer("address", agentPda.toBase58())}`);
  console.log("\nBootstrap complete. Jobs created from the app will now hit the chain.");
}

main().catch((e) => {
  console.error("bootstrap failed:", e.message ?? e);
  process.exit(1);
});
