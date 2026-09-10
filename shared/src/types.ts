/** Domain types mirrored between the on-chain program, backend, and frontend. */

export enum JobStatus {
  Created = "Created",
  Escrowed = "Escrowed",
  Executing = "Executing",
  Verified = "Verified",
  Rejected = "Rejected",
  Settled = "Settled",
}

export enum AttestationStatus {
  None = "None",
  Submitted = "Submitted",
  Verified = "Verified",
  Rejected = "Rejected",
}

export interface Agent {
  agentId: string;
  authority: string; // provider wallet pubkey (base58)
  modelId: string;
  /** Allowlisted enclave measurement (MRTD), hex. */
  expectedMeasurement: string;
  /** ed25519 public key of the enclave quoting key (base58). */
  quotingKey: string;
  /** Price in USDC base units. */
  price: number;
  completed: number;
  verified: number;
  rejected: number;
  reputation: number;
  capabilities: string[];
}

export interface Job {
  jobId: string;
  creator: string;
  agent: string;
  status: JobStatus;
  attestationStatus: AttestationStatus;
  /** USDC base units held in escrow. */
  budget: number;
  createdAt: number;
  /** sha256 of the ciphertext handed to the enclave, hex. */
  promptCiphertextCommitment: string;
  inputCommitment: string;
  outputCommitment: string;
  /** Where the encrypted output is retrievable (opaque ref). */
  outputCiphertextRef: string;
  expectedMeasurement: string;
  /** Random per-job nonce binding the attestation, hex. */
  nonce: string;
  /** Idempotency key guarding settlement. */
  settlementId: string;
}

/**
 * TDX-shaped attestation quote. In the MVP the signature is ed25519 from the
 * stub enclave's quoting key; the field layout matches a real TDX quote so the
 * on-chain verifier and the eventual real enclave are drop-in compatible.
 */
export interface AttestationQuote {
  /** sha256(input ‖ output ‖ modelId ‖ nonce), 32 bytes hex. */
  reportData: string;
  /** Enclave image measurement, 48 bytes hex. */
  mrtd: string;
  /** Runtime measurement register(s), hex (may be empty in the stub). */
  rtmr: string;
  /** Signature over reportData by quotingKey, 64 bytes hex. */
  signature: string;
  /** ed25519 public key that produced the signature, base58. */
  quotingKey: string;
}
