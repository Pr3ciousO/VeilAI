use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use constants::MEASUREMENT_LEN;
use instructions::*;

declare_id!("86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT");

/// VeilAI — private, verifiable execution infrastructure for AI agents.
///
/// Phase 1 (this module): core job lifecycle on the base layer.
/// PER delegation/permissions (Phase 2), attestation verification (Phase 3),
/// and Magic Action settlement (Phase 4) are added incrementally — see plan.md.
#[ephemeral]
#[program]
pub mod veilai {
    use super::*;

    /// Register an AI provider/agent with its allowlisted enclave measurement,
    /// quoting key, model id, and price.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        model_id: String,
        expected_measurement: [u8; MEASUREMENT_LEN],
        quoting_key: [u8; 32],
        price: u64,
    ) -> Result<()> {
        instructions::register_agent::handler(
            ctx,
            model_id,
            expected_measurement,
            quoting_key,
            price,
        )
    }

    /// Create a confidential job. Only commitments are stored on-chain; the
    /// plaintext prompt never touches the account.
    pub fn create_job(
        ctx: Context<CreateJob>,
        job_id: u64,
        prompt_ciphertext_commitment: [u8; 32],
        input_commitment: [u8; 32],
        nonce: [u8; 32],
        budget: u64,
    ) -> Result<()> {
        instructions::create_job::handler(
            ctx,
            job_id,
            prompt_ciphertext_commitment,
            input_commitment,
            nonce,
            budget,
        )
    }

    /// Escrow the job budget in a program-controlled USDC vault before
    /// execution — the funds verification will later release or refund.
    pub fn deposit_escrow(ctx: Context<DepositEscrow>) -> Result<()> {
        instructions::deposit_escrow::handler(ctx)
    }
}
