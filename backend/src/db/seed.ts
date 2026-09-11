/**
 * Superseded by `chain:bootstrap`.
 *
 * Seeding an agent is no longer a database-only operation: an agent must be
 * registered on-chain (to get its PDA and have its quoting key allowlisted) and
 * have its system prompt sealed to the enclave. Writing a row without those
 * produces a listing whose jobs can never verify.
 */
console.error(
  "This script is superseded — run `pnpm --filter @veilai/backend chain:bootstrap` instead.\n" +
    "It registers the agent on-chain, seals its system prompt, and mirrors it to Supabase.",
);
process.exit(1);
