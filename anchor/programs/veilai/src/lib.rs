use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod ed25519;
pub mod errors;
pub mod instructions;
pub mod state;

use constants::MEASUREMENT_LEN;
use ephemeral_rollups_sdk::access_control::structs::Member;
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

    /// Register an AI agent with its allowlisted enclave measurement, quoting
    /// key, model id, config commitment, and price. `agent_id` is unique per
    /// authority, so one operator can list many agents.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: u64,
        model_id: String,
        config_commitment: [u8; 32],
        expected_measurement: [u8; MEASUREMENT_LEN],
        quoting_key: [u8; 32],
        price: u64,
    ) -> Result<()> {
        instructions::register_agent::handler(
            ctx,
            agent_id,
            model_id,
            config_commitment,
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

    // ─── Phase 2: MagicBlock PER ────────────────────────────────────────

    /// Delegate the Job data PDA into the (private) Ephemeral Rollup (base layer).
    pub fn delegate_job(ctx: Context<DelegateJob>, job_id: u64) -> Result<()> {
        instructions::delegate_job::handler(ctx, job_id)
    }

    /// Create the job's EphemeralPermission on the ER (members = creator+provider).
    pub fn init_permission(ctx: Context<PermissionContext>, members: Vec<Member>) -> Result<()> {
        instructions::permission::init_permission(ctx, members)
    }

    /// Replace the job's EphemeralPermission member list on the ER.
    pub fn set_permission(
        ctx: Context<PermissionContext>,
        is_private: bool,
        members: Vec<Member>,
    ) -> Result<()> {
        instructions::permission::set_permission(ctx, is_private, members)
    }

    /// Close the job's EphemeralPermission on the ER (before undelegation).
    pub fn close_permission(ctx: Context<PermissionContext>) -> Result<()> {
        instructions::permission::close_permission(ctx)
    }

    /// Provider marks the delegated job as executing (ER).
    pub fn execute_marker(ctx: Context<ExecuteMarker>) -> Result<()> {
        instructions::execute_marker::handler(ctx)
    }

    // ─── Phase 3: Attestation verification ──────────────────────────────

    /// Verify the enclave attestation (Ed25519 precompile + measurement
    /// allowlist) and record Verified/Rejected. See `verify_attestation.rs`.
    pub fn verify_attestation(
        ctx: Context<VerifyAttestation>,
        output_commitment: [u8; 32],
        mrtd: [u8; MEASUREMENT_LEN],
        signature: [u8; 64],
        ed25519_ix_index: u8,
    ) -> Result<()> {
        instructions::verify_attestation::handler(
            ctx,
            output_commitment,
            mrtd,
            signature,
            ed25519_ix_index,
        )
    }

    // ─── Phase 4: Settlement ────────────────────────────────────────────

    /// Release escrow to the provider for a Verified job (direct, Signer-authorized).
    pub fn settle_payment_direct(ctx: Context<SettleDirect>) -> Result<()> {
        instructions::settlement::settle_payment_direct(ctx)
    }

    /// Refund escrow to the creator for a Rejected job (direct, Signer-authorized).
    pub fn refund_escrow_direct(ctx: Context<RefundDirect>) -> Result<()> {
        instructions::settlement::refund_escrow_direct(ctx)
    }
}
