use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum JobStatus {
    Created,
    Escrowed,
    Executing,
    Verified,
    Rejected,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum AttestationStatus {
    None,
    Submitted,
    Verified,
    Rejected,
}

/// A registered AI provider/agent. One agent per provider wallet in the MVP.
#[account]
pub struct Agent {
    pub authority: Pubkey,
    /// Model identifier used when recomputing the attestation report data.
    pub model_id: String,
    /// Allowlisted enclave measurement (MRTD).
    pub expected_measurement: [u8; MEASUREMENT_LEN],
    /// ed25519 public key of the enclave quoting key (stub TEE key in the MVP).
    pub quoting_key: [u8; 32],
    /// Price per job, USDC base units.
    pub price: u64,
    pub completed: u64,
    pub verified: u64,
    pub rejected: u64,
    /// Reputation, basis points (0..=10_000).
    pub reputation: u64,
    pub bump: u8,
}

impl Agent {
    pub const SPACE: usize = 8
        + 32                        // authority
        + (4 + MAX_MODEL_ID_LEN)    // model_id
        + MEASUREMENT_LEN           // expected_measurement
        + 32                        // quoting_key
        + 8                         // price
        + 8 + 8 + 8                 // completed, verified, rejected
        + 8                         // reputation
        + 1; // bump
}

/// A confidential job. Sensitive plaintext never lives here — only commitments.
#[account]
pub struct Job {
    pub job_id: u64,
    pub creator: Pubkey,
    /// The Agent PDA selected for this job.
    pub agent: Pubkey,
    /// Provider wallet (agent.authority), copied so ER-side auth needs no agent read.
    pub provider: Pubkey,
    pub status: JobStatus,
    pub attestation_status: AttestationStatus,
    /// USDC base units held in escrow for this job.
    pub budget: u64,
    pub created_at: i64,
    /// sha256 of the ciphertext handed to the enclave.
    pub prompt_ciphertext_commitment: [u8; 32],
    /// Commitment to the plaintext input (bound into report_data).
    pub input_commitment: [u8; 32],
    /// Commitment to the output, recorded on verification.
    pub output_commitment: [u8; 32],
    /// Copied from the agent at creation so the allowlist is fixed for the job.
    pub expected_measurement: [u8; MEASUREMENT_LEN],
    pub quoting_key: [u8; 32],
    /// Copied from the agent; needed to recompute report_data on-chain.
    pub model_id: String,
    /// Random per-job nonce binding the attestation.
    pub nonce: [u8; 32],
    /// Idempotency key guarding settlement.
    pub settlement_id: [u8; 32],
    pub bump: u8,
}

impl Job {
    pub const SPACE: usize = 8
        + 8                         // job_id
        + 32                        // creator
        + 32                        // agent
        + 32                        // provider
        + 1                         // status
        + 1                         // attestation_status
        + 8                         // budget
        + 8                         // created_at
        + 32                        // prompt_ciphertext_commitment
        + 32                        // input_commitment
        + 32                        // output_commitment
        + MEASUREMENT_LEN           // expected_measurement
        + 32                        // quoting_key
        + (4 + MAX_MODEL_ID_LEN)    // model_id
        + 32                        // nonce
        + 32                        // settlement_id
        + 1; // bump
}
