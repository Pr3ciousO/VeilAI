import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  baseRpc: required("SOLANA_RPC_ENDPOINT", "https://rpc.magicblock.app/devnet"),
  router: required("ROUTER_ENDPOINT", "https://devnet-router.magicblock.app/"),
  erFallback: required("EPHEMERAL_PROVIDER_ENDPOINT", "https://devnet-as.magicblock.app/"),
  usdcMint: required("USDC_MINT", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  paymentsApi: required("PAYMENTS_API_BASE", "https://payments.magicblock.app"),
  programId: process.env.VEILAI_PROGRAM_ID ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  enclaveQuotingSecret: process.env.ENCLAVE_QUOTING_SECRET ?? "",
  enclaveMeasurement: process.env.ENCLAVE_MEASUREMENT ?? "",
  /**
   * x25519 secret prompts are sealed to. Must persist across restarts —
   * a per-process key would make every stored ciphertext (job prompts, agent
   * system prompts) permanently unopenable on the next boot. A real TEE has the
   * equivalent in its sealing key.
   */
  enclaveX25519Secret: process.env.ENCLAVE_X25519_SECRET ?? "",
  privyAppId: process.env.PRIVY_APP_ID ?? "",
  privyAppSecret: process.env.PRIVY_APP_SECRET ?? "",
  /** Comma-separated origins allowed to call this API. Empty = allow all (dev). */
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};
