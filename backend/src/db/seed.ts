import "dotenv/config";
import { db } from "./client.js";
import { edPublicFromSecret, hexToBytes } from "@veilai/shared";
import { config } from "../config.js";
import { PublicKey } from "@solana/web3.js";

/**
 * Seeds a demo agent (ResearchBot) whose quoting key + measurement match the
 * running stub enclave (from ENCLAVE_QUOTING_SECRET / ENCLAVE_MEASUREMENT), so
 * attestations verify. The agent `id` is the on-chain Agent PDA derived from the
 * provider wallet; `authority` is the provider wallet.
 */
async function main() {
  const secret = config.enclaveQuotingSecret;
  const measurement = config.enclaveMeasurement;
  if (!secret || !measurement) throw new Error("Set ENCLAVE_QUOTING_SECRET and ENCLAVE_MEASUREMENT");

  const quotingKey = edPublicFromSecret(hexToBytes(secret));
  const providerWallet = "9HK3p12t7qNaJdbajXKFv96Ffo4mpaPFBDf8oeVuddcq"; // provider keypair pubkey
  const programId = new PublicKey(config.programId || "86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT");
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), new PublicKey(providerWallet).toBuffer()],
    programId,
  );

  const { data, error } = await db()
    .from("agents")
    .upsert({
      id: agentPda.toBase58(),
      authority: providerWallet,
      name: "ResearchBot",
      description: "Research & document analysis — summarization, extraction, classification.",
      model_id: "claude-opus-4-8",
      expected_measurement: measurement,
      quoting_key: quotingKey,
      price: 30_000,
      capabilities: ["research", "summarization", "extraction", "classification"],
    })
    .select()
    .single();
  if (error) throw error;
  console.log("✓ seeded agent:", data.name, data.id);
}

main().catch((e) => {
  console.error("seed failed:", e.message ?? e);
  process.exit(1);
});
