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
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
  getMint,
} from "@solana/spl-token";
import {
  edPublicFromSecret,
  hexToBytes,
  commitAgentConfig,
  newAgentId,
  sealTo,
  type AgentConfig,
} from "@veilai/shared";
import { getChain, chainEnabled, explorer } from "./client.js";
import { registerAgentOnChain } from "./lifecycle.js";
import { enclavePublicKey } from "../enclave/key.js";
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

  // ─── 1. Stand-in USDC the creator can actually fund ──────────────────
  // Escrow is real: deposit_escrow moves tokens, so a creator with no balance
  // blocks every job. We need a mint we control, not just one that exists.
  let mint = chain.usdcMint;
  let mintUsable = false;

  const mintInfo = await chain.connection.getAccountInfo(mint);
  if (mintInfo) {
    const info = await getMint(chain.connection, mint);
    const isAuthority = info.mintAuthority?.equals(chain.creator.publicKey) ?? false;
    const ata = getAssociatedTokenAddressSync(mint, chain.creator.publicKey);
    let held = BigInt(0);
    try {
      held = (await getAccount(chain.connection, ata)).amount;
    } catch {
      /* ATA not created yet */
    }
    // Usable if we can mint more, or already hold enough to run the demo.
    mintUsable = isAuthority || held >= BigInt(1_000_000);
    if (!mintUsable) {
      console.log(
        `! USDC_MINT ${mint.toBase58()} is not mintable by the creator ` +
          `(authority ${info.mintAuthority?.toBase58() ?? "none"}) and the balance is ` +
          `${Number(held) / 1e6} — creating a stand-in mint instead.`,
      );
    }
  }

  if (!mintUsable) {
    mint = await createMint(chain.connection, chain.creator, chain.creator.publicKey, null, 6);
    console.log(`\n  ⚠ Put this in backend/.env and re-run bootstrap:\n    USDC_MINT=${mint.toBase58()}\n`);
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
    await mintTo(
      chain.connection,
      chain.creator,
      mint,
      creatorAta.address,
      chain.creator,
      MINT_AMOUNT,
    );
    console.log(`✓ minted ${MINT_AMOUNT / 1e6} stand-in USDC to creator`);
  } else {
    console.log(`✓ creator holds ${Number(held) / 1e6} USDC`);
  }

  if (!mint.equals(chain.usdcMint)) {
    console.error(
      "\n✗ USDC_MINT in .env still points at the old mint. Update it to the address above,\n" +
        "  then re-run bootstrap — escrow will fail until it matches.\n",
    );
    process.exit(1);
  }

  // ─── 2. Retire listings that predate agent_id / config binding ───────
  // Their PDAs were derived under the old seed and their accounts use the old
  // layout, so create_job fails its seeds constraint. Counting rows isn't the
  // test — a stale row is worse than no row, because it looks selectable.
  const { data: stale } = await db()
    .from("agents")
    .select("id, name")
    .is("agent_id", null);
  if (stale?.length) {
    for (const a of stale) {
      await db().from("agents").delete().eq("id", a.id);
      console.log(`✗ removed stale listing "${a.name}" (registered before agent_id existed)`);
    }
  }

  // ─── 3. Seed one agent so the marketplace isn't empty ────────────────
  // Further agents are listed through the app; this is just a starting listing.
  const { count } = await db()
    .from("agents")
    .select("id", { count: "exact", head: true })
    .not("agent_id", "is", null);
  if (count && count > 0) {
    console.log(`✓ ${count} usable agent(s) already listed — skipping seed agent`);
    console.log("\nBootstrap complete.");
    return;
  }

  const systemPrompt =
    process.env.AGENT_SYSTEM_PROMPT ??
    "You are a meticulous research analyst. Given a document or question, produce a " +
      "structured, factual answer: lead with the direct conclusion, support it with " +
      "specifics drawn only from the material provided, and state plainly when the " +
      "material is insufficient rather than speculating.";
  const modelId = process.env.AGENT_MODEL_ID ?? "claude-opus-4-8";
  const price = Number(process.env.AGENT_PRICE ?? 30_000);
  const agentConfig: AgentConfig = {
    systemPrompt,
    modelId,
    temperature: 1,
    maxTokens: 4096,
  };
  const configCommitment = commitAgentConfig(agentConfig);
  const quotingKeyB58 = edPublicFromSecret(hexToBytes(config.enclaveQuotingSecret));
  const agentId = newAgentId();

  const onChain = await registerAgentOnChain({
    agentId,
    modelId,
    configCommitment,
    measurement: config.enclaveMeasurement,
    quotingKeyB58,
    price,
  });
  console.log(`✓ agent registered — ${explorer("tx", onChain.signature)}`);

  const sealedPrompt = await sealTo(enclavePublicKey(), new TextEncoder().encode(systemPrompt));

  const { error } = await db().from("agents").insert({
    id: onChain.agentPda,
    authority: onChain.authority,
    agent_id: agentId,
    name: process.env.AGENT_NAME ?? "ResearchBot",
    description: "Research & document analysis — summarization, extraction, classification.",
    model_id: modelId,
    config_commitment: configCommitment,
    system_prompt_ciphertext: sealedPrompt,
    temperature: 1,
    max_tokens: 4096,
    expected_measurement: config.enclaveMeasurement,
    quoting_key: quotingKeyB58,
    price,
    capabilities: ["research", "summarization", "extraction", "classification"],
    register_tx: onChain.signature,
  });
  if (error) throw error;

  console.log(`✓ agent mirrored to Supabase — ${explorer("address", onChain.agentPda)}`);
  console.log("\nBootstrap complete. Jobs created from the app will now hit the chain.");
}

main().catch((e) => {
  console.error("bootstrap failed:", e.message ?? e);
  process.exit(1);
});
