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
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};
