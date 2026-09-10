"use client";

import {
  newX25519Keypair,
  openSealed,
  x25519PublicFromSecret,
  type SealedBox,
} from "@veilai/shared";
import bs58 from "bs58";

const KEY = "veilai:userkey";

/**
 * A persistent client-side x25519 keypair used to receive sealed job output.
 * The public key is handed to the enclave (via /execute) so it can seal the
 * result; only this browser can open it. Stored in localStorage for the demo.
 */
export function getUserKey(): { secret: Uint8Array; publicB58: string } {
  if (typeof window === "undefined") return { secret: new Uint8Array(), publicB58: "" };
  const existing = window.localStorage.getItem(KEY);
  if (existing) {
    const secret = bs58.decode(existing);
    return { secret, publicB58: x25519PublicFromSecret(secret) };
  }
  const kp = newX25519Keypair();
  window.localStorage.setItem(KEY, bs58.encode(kp.secret));
  return kp;
}

export async function openResult(box: SealedBox): Promise<string> {
  const { secret } = getUserKey();
  const bytes = await openSealed(secret, box);
  return new TextDecoder().decode(bytes);
}
