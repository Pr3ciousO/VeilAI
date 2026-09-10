import { AttestationQuote } from "./types.js";
import { computeReportData, computeSignedMessage, hexToBytes, bytesToHex } from "./commitment.js";
import { edSign, edVerify } from "./crypto.js";
import bs58 from "bs58";

/**
 * Build a stub-enclave attestation quote. This mirrors the on-chain
 * `verify_attestation` binding: the signed message is the report_data derived
 * from the job's commitments, model id, and nonce.
 *
 * STUB: signature is ed25519 from the enclave quoting key. Real TDX swaps the
 * signer + adds DCAP quote verification; report_data + measurement checks stay.
 */
export function buildQuote(params: {
  inputCommitment: string;
  outputCommitment: string;
  modelId: string;
  nonce: string;
  mrtd: string;
  rtmr?: string;
  quotingSecret: Uint8Array;
  quotingKeyB58: string;
}): AttestationQuote {
  const reportData = computeReportData({
    inputCommitment: params.inputCommitment,
    outputCommitment: params.outputCommitment,
    modelId: params.modelId,
    nonce: params.nonce,
  });
  // The enclave signs sha256(report_data ‖ mrtd) so the measurement is bound.
  const signedMessage = computeSignedMessage(reportData, params.mrtd);
  const signature = edSign(params.quotingSecret, hexToBytes(signedMessage));
  return {
    reportData,
    mrtd: params.mrtd,
    rtmr: params.rtmr ?? "",
    signature: bytesToHex(signature),
    quotingKey: params.quotingKeyB58,
  };
}

/** The 32-byte message the ed25519 signature covers, hex. */
export function quoteSignedMessage(quote: AttestationQuote): string {
  return computeSignedMessage(quote.reportData, quote.mrtd);
}

/**
 * Off-chain mirror of the on-chain verifier's four checks. Useful for backend
 * pre-flight and tests; the authoritative check runs in the program.
 */
export function verifyQuote(
  quote: AttestationQuote,
  expected: {
    inputCommitment: string;
    outputCommitment: string;
    modelId: string;
    nonce: string;
    allowlistedQuotingKey: string;
    expectedMeasurement: string;
  },
): { ok: boolean; reason?: string } {
  const recomputed = computeReportData({
    inputCommitment: expected.inputCommitment,
    outputCommitment: expected.outputCommitment,
    modelId: expected.modelId,
    nonce: expected.nonce,
  });
  if (recomputed !== quote.reportData) return { ok: false, reason: "report_data mismatch" };
  if (quote.quotingKey !== expected.allowlistedQuotingKey)
    return { ok: false, reason: "quoting key not allowlisted" };
  if (quote.mrtd.toLowerCase() !== expected.expectedMeasurement.toLowerCase())
    return { ok: false, reason: "measurement not allowlisted" };
  const signedMessage = computeSignedMessage(quote.reportData, quote.mrtd);
  const sigOk = edVerify(quote.quotingKey, hexToBytes(quote.signature), hexToBytes(signedMessage));
  if (!sigOk) return { ok: false, reason: "invalid signature" };
  return { ok: true };
}

export { bs58 };
