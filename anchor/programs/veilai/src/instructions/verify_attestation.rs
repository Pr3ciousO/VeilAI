use crate::constants::*;
use crate::ed25519::extract_verified_ed25519;
use crate::errors::VeilError;
use crate::state::{AttestationStatus, Job, JobStatus};
use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

/// Instructions sysvar program id.
const INSTRUCTIONS_SYSVAR_ID: Pubkey =
    Pubkey::from_str_const("Sysvar1nstructions1111111111111111111111111");

fn sha256_concat(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    for p in parts {
        h.update(p);
    }
    h.finalize().into()
}

#[event]
pub struct AttestationVerified {
    pub job_id: u64,
    pub output_commitment: [u8; 32],
}

#[event]
pub struct AttestationRejected {
    pub job_id: u64,
    pub reason: String,
}

/// Verify the enclave attestation and record the outcome on-chain.
///
/// The transaction must include, just before this instruction, an Ed25519
/// precompile instruction that proves `signature` is a valid signature by the
/// job's quoting key over `sha256(report_data ‖ mrtd)`. The precompile performs
/// the cryptography; this instruction confirms it verified the *right* triple:
///
///   1. quoting key == the job's allowlisted key,
///   2. signed message == our recomputed `sha256(report_data ‖ mrtd)`,
///   3. mrtd == the job's allowlisted measurement.
///
/// All three pass → `Verified` (+ output commitment recorded). Otherwise the job
/// is persisted as `Rejected` so settlement can refund the escrow.
pub fn handler(
    ctx: Context<VerifyAttestation>,
    output_commitment: [u8; 32],
    mrtd: [u8; MEASUREMENT_LEN],
    signature: [u8; 64],
    ed25519_ix_index: u8,
) -> Result<()> {
    require!(
        ctx.accounts.job.status == JobStatus::Executing,
        VeilError::BadStatus
    );

    let job = &ctx.accounts.job;

    // report_data = sha256(input ‖ output ‖ model_id ‖ nonce)
    let report_data = sha256_concat(&[
        &job.input_commitment,
        &output_commitment,
        job.model_id.as_bytes(),
        &job.nonce,
    ]);
    // signed_message = sha256(report_data ‖ mrtd) — measurement bound to the sig.
    let signed_message = sha256_concat(&[&report_data, &mrtd]);

    let verified = extract_verified_ed25519(
        &ctx.accounts.instructions_sysvar,
        ed25519_ix_index as usize,
    )?;

    let key_ok = verified.pubkey == job.quoting_key;
    let msg_ok = verified.message.as_slice() == signed_message.as_slice();
    let sig_ok = verified.signature == signature;
    let measurement_ok = mrtd == job.expected_measurement;

    let job = &mut ctx.accounts.job;
    if key_ok && msg_ok && sig_ok && measurement_ok {
        job.output_commitment = output_commitment;
        job.status = JobStatus::Verified;
        job.attestation_status = AttestationStatus::Verified;
        emit!(AttestationVerified {
            job_id: job.job_id,
            output_commitment,
        });
    } else {
        job.status = JobStatus::Rejected;
        job.attestation_status = AttestationStatus::Rejected;
        let reason = if !key_ok {
            "quoting key not allowlisted"
        } else if !measurement_ok {
            "measurement not allowlisted"
        } else if !msg_ok {
            "report data / signed message mismatch"
        } else {
            "signature mismatch"
        };
        emit!(AttestationRejected {
            job_id: job.job_id,
            reason: reason.to_string(),
        });
        msg!("VeilAI: attestation REJECTED — {}", reason);
    }

    Ok(())
}

#[derive(Accounts)]
pub struct VerifyAttestation<'info> {
    #[account(
        mut,
        seeds = [JOB_SEED, job.creator.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump,
        has_one = provider @ VeilError::Unauthorized
    )]
    pub job: Account<'info, Job>,
    pub provider: Signer<'info>,
    /// CHECK: Instructions sysvar, read via introspection to confirm the Ed25519 precompile ran.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}
