/**
 * Generate the enclave's persistent secrets.
 *
 * These stand in for what a real TEE holds internally: an x25519 sealing key
 * (prompts are encrypted to it) and an ed25519 quoting key (attestations are
 * signed with it). Both MUST outlive the process — ciphertext in the database
 * is only openable by the x25519 key that sealed it, and the quoting key is
 * what the on-chain agent allowlists.
 *
 * Run: pnpm --filter @veilai/backend enclave:keygen
 */
import { newX25519Keypair, newEd25519Keypair, bytesToHex } from "@veilai/shared";
import * as crypto from "crypto";

const x = newX25519Keypair();
const ed = newEd25519Keypair();
const randomBytes = (n: number) => new Uint8Array(crypto.randomBytes(n));

console.log("Add these to backend/.env — they must not change once agents are registered:\n");
console.log(`ENCLAVE_X25519_SECRET=${bytesToHex(x.secret)}`);
console.log(`ENCLAVE_QUOTING_SECRET=${bytesToHex(ed.secret)}`);
console.log(`ENCLAVE_MEASUREMENT=${bytesToHex(randomBytes(48))}`);
console.log("\nx25519 public (prompts seal to this):", x.publicB58);
console.log("ed25519 quoting key (allowlisted on-chain):", ed.publicB58);
console.log(
  "\nChanging ENCLAVE_QUOTING_SECRET or ENCLAVE_MEASUREMENT after registering an agent\n" +
    "makes every attestation fail verification — register_agent cannot be updated.",
);
