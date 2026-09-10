/** USDC base units (6 decimals) → display string. */
export function usdc(baseUnits: number): string {
  return `$${(baseUnits / 1_000_000).toFixed(2)}`;
}

/** Shorten a hex/base58 string for display. */
export function short(s: string, n = 6): string {
  if (!s) return "";
  return s.length <= n * 2 ? s : `${s.slice(0, n)}…${s.slice(-4)}`;
}
