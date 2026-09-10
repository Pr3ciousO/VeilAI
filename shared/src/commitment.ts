import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes, concatBytes } from "@noble/hashes/utils";

/** sha256 of arbitrary bytes, hex-encoded. */
export function commit(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

/** Commitment over a UTF-8 string. */
export function commitString(s: string): string {
  return commit(utf8ToBytes(s));
}

/**
 * report_data = sha256(inputCommitment ‖ outputCommitment ‖ modelId ‖ nonce).
 * Inputs that are hex commitments/nonce are decoded to raw bytes first so the
 * binding matches what the on-chain program recomputes.
 */
export function computeReportData(params: {
  inputCommitment: string;
  outputCommitment: string;
  modelId: string;
  nonce: string;
}): string {
  const parts = concatBytes(
    hexToBytes(params.inputCommitment),
    hexToBytes(params.outputCommitment),
    utf8ToBytes(params.modelId),
    hexToBytes(params.nonce),
  );
  return bytesToHex(sha256(parts));
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export { bytesToHex };
