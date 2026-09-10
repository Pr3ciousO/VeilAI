import { ed25519, x25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";

/**
 * Prompt/output confidentiality uses x25519 ECDH to derive a shared key, then
 * AES-256-GCM (via WebCrypto) to seal the payload. The prompt is sealed to the
 * enclave's x25519 public key in the browser; the output is sealed back to the
 * user's key inside the enclave.
 */

export interface SealedBox {
  /** Ephemeral x25519 public key, base58. */
  epk: string;
  /** 12-byte GCM nonce, base58. */
  nonce: string;
  /** Ciphertext + tag, base58. */
  ct: string;
}

/** Copy into a fresh ArrayBuffer-backed view so WebCrypto's BufferSource types are satisfied. */
function ab(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

async function aesKey(shared: Uint8Array): Promise<CryptoKey> {
  const raw = sha256(shared); // 32-byte AES key from the ECDH secret
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealTo(recipientPubB58: string, message: Uint8Array): Promise<SealedBox> {
  const recipient = bs58.decode(recipientPubB58);
  const ephSecret = x25519.utils.randomPrivateKey();
  const ephPublic = x25519.getPublicKey(ephSecret);
  const shared = x25519.getSharedSecret(ephSecret, recipient);
  const key = await aesKey(shared);
  const nonce = randomBytes(12);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(nonce) }, key, ab(message));
  return {
    epk: bs58.encode(ephPublic),
    nonce: bs58.encode(nonce),
    ct: bs58.encode(new Uint8Array(ctBuf)),
  };
}

export async function openSealed(recipientSecret: Uint8Array, box: SealedBox): Promise<Uint8Array> {
  const shared = x25519.getSharedSecret(recipientSecret, bs58.decode(box.epk));
  const key = await aesKey(shared);
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ab(bs58.decode(box.nonce)) },
    key,
    ab(bs58.decode(box.ct)),
  );
  return new Uint8Array(ptBuf);
}

/** x25519 keypair (for prompt/output sealing). */
export function newX25519Keypair(): { secret: Uint8Array; publicB58: string } {
  const secret = x25519.utils.randomPrivateKey();
  return { secret, publicB58: bs58.encode(x25519.getPublicKey(secret)) };
}

/** ed25519 — stub enclave quoting key (stands in for TEE hardware key). */
export function newEd25519Keypair(): { secret: Uint8Array; publicB58: string } {
  const secret = ed25519.utils.randomPrivateKey();
  return { secret, publicB58: bs58.encode(ed25519.getPublicKey(secret)) };
}

export function edSign(secret: Uint8Array, msg: Uint8Array): Uint8Array {
  return ed25519.sign(msg, secret);
}

/** ed25519 public key (base58) from a 32-byte secret seed. */
export function edPublicFromSecret(secret: Uint8Array): string {
  return bs58.encode(ed25519.getPublicKey(secret));
}

export function edVerify(pubB58: string, sig: Uint8Array, msg: Uint8Array): boolean {
  return ed25519.verify(sig, msg, bs58.decode(pubB58));
}

export { bs58 };
