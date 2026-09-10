use crate::constants::*;
use crate::errors::VeilError;
use crate::state::{Job, JobStatus};
use anchor_lang::prelude::*;

/// Provider marks the (delegated) job as executing on the ER. Runs against the
/// private ER state; the provider must be a permission member to reach it.
pub fn handler(ctx: Context<ExecuteMarker>) -> Result<()> {
    let job = &mut ctx.accounts.job;
    require!(job.status == JobStatus::Escrowed, VeilError::BadStatus);
    job.status = JobStatus::Executing;
    msg!("VeilAI: job #{} executing", job.job_id);
    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteMarker<'info> {
    #[account(
        mut,
        seeds = [JOB_SEED, job.creator.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump,
        has_one = provider @ VeilError::Unauthorized
    )]
    pub job: Account<'info, Job>,
    pub provider: Signer<'info>,
}
