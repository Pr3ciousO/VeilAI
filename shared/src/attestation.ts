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

export type AttestationCheckId = "quoting_key" | "measurement" | "report_data" | "signature";

export interface AttestationCheck {
  id: AttestationCheckId;
  /** Short label for display. */
  label: string;
  ok: boolean;
  /** The value the verifier required. */
  expected: string;
  /** The value the quote actually carried. */
  actual: string;
  /** The cheat this check makes impossible — the reason it exists. */
  guards: string;
  /** On-chain reason string emitted when this check is the one that fails. */
  reason: string;
}

export interface AttestationReport {
  ok: boolean;
  /** Reason from the first failing check, in on-chain precedence order. */
  reason?: string;
  checks: AttestationCheck[];
}

export interface AttestationExpectation {
  inputCommitment: string;
  outputCommitment: string;
  modelId: string;
  nonce: string;
  allowlistedQuotingKey: string;
  expectedMeasurement: string;
}

/**
 * Off-chain mirror of the on-chain verifier, reporting each check separately
 * rather than short-circuiting — so a client can show which specific guarantee
 * failed. Check order and reason strings match `verify_attestation`'s
 * precedence; the authoritative check still runs in the program.
 */
export function verifyQuoteDetailed(
  quote: AttestationQuote,
  expected: AttestationExpectation,
): AttestationReport {
  const recomputed = computeReportData({
    inputCommitment: expected.inputCommitment,
    outputCommitment: expected.outputCommitment,
    modelId: expected.modelId,
    nonce: expected.nonce,
  });
  const signedMessage = computeSignedMessage(quote.reportData, quote.mrtd);

  // Signature validity is only meaningful against the key the quote claims;
  // `quoting_key` above is what ties that key to the registered agent.
  let sigOk = false;
  try {
    sigOk = edVerify(quote.quotingKey, hexToBytes(quote.signature), hexToBytes(signedMessage));
  } catch {
    sigOk = false; // malformed key/signature encoding is a failed check, not a crash
  }

  const checks: AttestationCheck[] = [
    {
      id: "quoting_key",
      label: "Quoting key allowlisted",
      ok: quote.quotingKey === expected.allowlistedQuotingKey,
      expected: expected.allowlistedQuotingKey,
      actual: quote.quotingKey,
      guards: "Signing from any enclave other than the one this agent registered.",
      reason: "quoting key not allowlisted",
    },
    {
      id: "measurement",
      label: "Measurement (MRTD) matches",
      ok: quote.mrtd.toLowerCase() === expected.expectedMeasurement.toLowerCase(),
      expected: expected.expectedMeasurement,
      actual: quote.mrtd,
      guards: "Running modified code inside a genuine TEE.",
      reason: "measurement not allowlisted",
    },
    {
      id: "report_data",
      label: "Report data binds this job",
      ok: recomputed === quote.reportData,
      expected: recomputed,
      actual: quote.reportData,
      guards: "Swapping the output, the model, or replaying another job's quote.",
      reason: "report_data mismatch",
    },
    {
      id: "signature",
      label: "Ed25519 signature valid",
      ok: sigOk,
      expected: signedMessage,
      actual: quote.signature,
      guards: "Forging an attestation without the enclave's private key.",
      reason: "invalid signature",
    },
  ];

  const failed = checks.find((c) => !c.ok);
  return { ok: !failed, reason: failed?.reason, checks };
}

/**
 * Pass/fail summary of {@link verifyQuoteDetailed}, for callers that only need
 * the verdict.
 */
export function verifyQuote(
  quote: AttestationQuote,
  expected: AttestationExpectation,
): { ok: boolean; reason?: string } {
  const { ok, reason } = verifyQuoteDetailed(quote, expected);
  return ok ? { ok } : { ok, reason };
}

export { bs58 };
