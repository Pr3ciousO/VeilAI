/** Network + protocol constants shared by backend and frontend. */

export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const ENDPOINTS = {
  baseRpc: "https://rpc.magicblock.app/devnet",
  router: "https://devnet-router.magicblock.app/",
  /** Fallback ER endpoint; prefer the fqdn from router getDelegationStatus. */
  ephemeralFallback: "https://devnet-as.magicblock.app/",
  paymentsApi: "https://payments.magicblock.app",
} as const;

/** Well-known MagicBlock program ids. */
export const PROGRAM_IDS = {
  delegation: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  magic: "Magic11111111111111111111111111111111111111",
  magicContext: "MagicContext1111111111111111111111111111111",
} as const;

/** Max members on a job's EphemeralPermission (creator + provider, with headroom). */
export const MAX_PERMISSION_MEMBERS = 4;

/** PDA seed prefixes — must match the on-chain program. */
export const SEEDS = {
  job: "job",
  agent: "agent",
  escrowVault: "escrow-vault",
} as const;
