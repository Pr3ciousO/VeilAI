use crate::constants::*;
use crate::errors::VeilError;
use crate::state::{Agent, AttestationStatus, Job, JobStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::access_control::structs::EphemeralPermission;

pub fn handler(
    ctx: Context<CreateJob>,
    job_id: u64,
    prompt_ciphertext_commitment: [u8; 32],
    input_commitment: [u8; 32],
    nonce: [u8; 32],
    budget: u64,
) -> Result<()> {
    require!(budget > 0, VeilError::InvalidBudget);

    let agent = &ctx.accounts.agent;
    let clock = Clock::get()?;

    let job = &mut ctx.accounts.job;
    job.job_id = job_id;
    job.creator = ctx.accounts.creator.key();
    job.agent = agent.key();
    job.provider = agent.authority;
    job.status = JobStatus::Created;
    job.attestation_status = AttestationStatus::None;
    job.budget = budget;
    job.created_at = clock.unix_timestamp;
    job.prompt_ciphertext_commitment = prompt_ciphertext_commitment;
    job.input_commitment = input_commitment;
    job.output_commitment = [0u8; 32];
    job.expected_measurement = agent.expected_measurement;
    job.quoting_key = agent.quoting_key;
    job.model_id = agent.model_id.clone();
    job.nonce = nonce;
    job.settlement_id = nonce; // unique per creator+job; guards double-settle
    job.settled = false;
    job.bump = ctx.bumps.job;

    // Pre-fund the Job PDA for the EphemeralPermission rent it will pay when the
    // job is delegated into the PER (Phase 2). Done at base-layer creation.
    let permission_rent =
        ephemeral_rollups_sdk::ephemeral_accounts::rent(
            EphemeralPermission::size_of(MAX_PERMISSION_MEMBERS) as u32,
        );
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.job.to_account_info(),
            },
        ),
        permission_rent,
    )?;

    msg!("VeilAI: created job #{}", job_id);
    Ok(())
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct CreateJob<'info> {
    #[account(
        init,
        payer = creator,
        space = Job::SPACE,
        seeds = [JOB_SEED, creator.key().as_ref(), &job_id.to_le_bytes()],
        bump
    )]
    pub job: Account<'info, Job>,
    #[account(
        seeds = [AGENT_SEED, agent.authority.as_ref()],
        bump = agent.bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
