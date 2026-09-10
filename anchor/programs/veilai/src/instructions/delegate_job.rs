use crate::constants::*;
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

/// Delegate the Job data PDA into the (private) Ephemeral Rollup on the base
/// layer. Only the data account is delegated; its `EphemeralPermission` is
/// created on the ER afterwards (see `permission.rs`).
pub fn handler(ctx: Context<DelegateJob>, job_id: u64) -> Result<()> {
    let creator_key = ctx.accounts.creator.key();
    let validator = ctx.accounts.validator.as_ref().map(|v| v.key());

    ctx.accounts.delegate_job(
        &ctx.accounts.creator,
        &[JOB_SEED, creator_key.as_ref(), &job_id.to_le_bytes()],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    msg!("VeilAI: delegated job #{} into PER", job_id);
    Ok(())
}

#[delegate]
#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct DelegateJob<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: The Job data PDA to delegate (owner changes to the delegation program).
    #[account(
        mut,
        del,
        seeds = [JOB_SEED, creator.key().as_ref(), &job_id.to_le_bytes()],
        bump
    )]
    pub job: AccountInfo<'info>,
    /// CHECK: Optional target TEE validator, forwarded in DelegateConfig.
    pub validator: Option<UncheckedAccount<'info>>,
}
