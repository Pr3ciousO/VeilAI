import { newX25519Keypair, hexToBytes, x25519PublicFromSecret } from "@veilai/shared";
import { config } from "../config.js";

let cached: Uint8Array | null = null;

/**
 * The enclave's x25519 secret — the key every prompt (job prompts and agent
 * system prompts) is sealed to.
 *
 * This MUST be stable across restarts: ciphertext stored in the database can
 * only ever be opened by this key. Falling back to a random key keeps local
 * development working, but anything sealed under it dies with the process, so
 * we say so loudly rather than failing mysteriously later.
 */
export function enclaveSecret(): Uint8Array {
  if (cached) return cached;
  if (config.enclaveX25519Secret) {
    cached = hexToBytes(config.enclaveX25519Secret);
  } else {
    const kp = newX25519Keypair();
    cached = kp.secret;
    console.warn(
      "⚠ ENCLAVE_X25519_SECRET is not set — using an ephemeral key.\n" +
        "  Prompts sealed to it become unopenable when this process exits.\n" +
        "  Generate one with: pnpm --filter @veilai/backend enclave:keygen",
    );
  }
  return cached;
}

export function enclavePublicKey(): string {
  return x25519PublicFromSecret(enclaveSecret());
}
