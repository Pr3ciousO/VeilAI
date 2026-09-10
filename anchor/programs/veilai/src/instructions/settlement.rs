use crate::constants::*;
use crate::errors::VeilError;
use crate::state::{Agent, Job, JobStatus};
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

#[event]
pub struct JobSettled {
    pub job_id: u64,
    pub amount: u64,
    pub to: Pubkey,
}

#[event]
pub struct JobRefunded {
    pub job_id: u64,
    pub amount: u64,
    pub to: Pubkey,
}

fn recompute_reputation(agent: &mut Agent) {
    // reputation (bps) = verified / completed * 10_000
    agent.reputation = agent
        .verified
        .saturating_mul(10_000)
        .checked_div(agent.completed.max(1))
        .unwrap_or(0);
}

/// Shared success path: release escrow to the provider, mark Settled, bump reputation.
/// `signer_seeds` must authorize the escrow authority PDA to move the vault tokens.
#[allow(clippy::too_many_arguments)]
fn do_settle<'info>(
    job: &mut Account<'info, Job>,
    agent: &mut Account<'info, Agent>,
    escrow_vault: &AccountInfo<'info>,
    provider_ata: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    decimals: u8,
    escrow_authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(job.status == JobStatus::Verified, VeilError::BadStatus);
    require!(!job.settled, VeilError::AlreadySettled);

    transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: escrow_vault.clone(),
                mint: mint.clone(),
                to: provider_ata.clone(),
                authority: escrow_authority.clone(),
            },
            signer_seeds,
        ),
        job.budget,
        decimals,
    )?;

    job.settled = true;
    job.status = JobStatus::Settled;
    agent.completed = agent.completed.saturating_add(1);
    agent.verified = agent.verified.saturating_add(1);
    recompute_reputation(agent);

    emit!(JobSettled {
        job_id: job.job_id,
        amount: job.budget,
        to: job.provider,
    });
    Ok(())
}

/// Shared failure path: refund escrow to the creator, mark settled, record a rejection.
#[allow(clippy::too_many_arguments)]
fn do_refund<'info>(
    job: &mut Account<'info, Job>,
    agent: &mut Account<'info, Agent>,
    escrow_vault: &AccountInfo<'info>,
    creator_ata: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    decimals: u8,
    escrow_authority: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require!(job.status == JobStatus::Rejected, VeilError::BadStatus);
    require!(!job.settled, VeilError::AlreadySettled);

    transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: escrow_vault.clone(),
                mint: mint.clone(),
                to: creator_ata.clone(),
                authority: escrow_authority.clone(),
            },
            signer_seeds,
        ),
        job.budget,
        decimals,
    )?;

    job.settled = true;
    agent.completed = agent.completed.saturating_add(1);
    agent.rejected = agent.rejected.saturating_add(1);
    recompute_reputation(agent);

    emit!(JobRefunded {
        job_id: job.job_id,
        amount: job.budget,
        to: job.creator,
    });
    Ok(())
}

fn escrow_signer_seeds<'a>(job_key: &'a Pubkey, bump: &'a [u8; 1]) -> [&'a [u8]; 3] {
    [ESCROW_AUTH_SEED, job_key.as_ref(), bump]
}

// ─── Direct entrypoints (Signer-authorized; the orchestrator's reliable path) ───

pub fn settle_payment_direct(ctx: Context<SettleDirect>) -> Result<()> {
    let caller = ctx.accounts.authority.key();
    require!(
        caller == ctx.accounts.job.provider || caller == ctx.accounts.job.creator,
        VeilError::Unauthorized
    );
    let job_key = ctx.accounts.job.key();
    let bump = [ctx.bumps.escrow_authority];
    let seeds = escrow_signer_seeds(&job_key, &bump);
    let signer: &[&[&[u8]]] = &[&seeds];

    let escrow_vault = ctx.accounts.escrow_vault.to_account_info();
    let provider_ata = ctx.accounts.provider_ata.to_account_info();
    let mint_info = ctx.accounts.usdc_mint.to_account_info();
    let decimals = ctx.accounts.usdc_mint.decimals;
    let escrow_authority = ctx.accounts.escrow_authority.to_account_info();
    let token_program = ctx.accounts.token_program.to_account_info();
    do_settle(
        &mut ctx.accounts.job,
        &mut ctx.accounts.agent,
        &escrow_vault,
        &provider_ata,
        &mint_info,
        decimals,
        &escrow_authority,
        &token_program,
        signer,
    )
}

pub fn refund_escrow_direct(ctx: Context<RefundDirect>) -> Result<()> {
    let caller = ctx.accounts.authority.key();
    require!(
        caller == ctx.accounts.job.provider || caller == ctx.accounts.job.creator,
        VeilError::Unauthorized
    );
    let job_key = ctx.accounts.job.key();
    let bump = [ctx.bumps.escrow_authority];
    let seeds = escrow_signer_seeds(&job_key, &bump);
    let signer: &[&[&[u8]]] = &[&seeds];

    let escrow_vault = ctx.accounts.escrow_vault.to_account_info();
    let creator_ata = ctx.accounts.creator_ata.to_account_info();
    let mint_info = ctx.accounts.usdc_mint.to_account_info();
    let decimals = ctx.accounts.usdc_mint.decimals;
    let escrow_authority = ctx.accounts.escrow_authority.to_account_info();
    let token_program = ctx.accounts.token_program.to_account_info();
    do_refund(
        &mut ctx.accounts.job,
        &mut ctx.accounts.agent,
        &escrow_vault,
        &creator_ata,
        &mint_info,
        decimals,
        &escrow_authority,
        &token_program,
        signer,
    )
}

#[derive(Accounts)]
pub struct SettleDirect<'info> {
    #[account(
        mut,
        seeds = [JOB_SEED, job.creator.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,
    #[account(
        mut,
        seeds = [AGENT_SEED, agent.authority.as_ref()],
        bump = agent.bump,
        address = job.agent @ VeilError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// CHECK: escrow authority PDA that owns the vault.
    #[account(seeds = [ESCROW_AUTH_SEED, job.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = job.provider,
    )]
    pub provider_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundDirect<'info> {
    #[account(
        mut,
        seeds = [JOB_SEED, job.creator.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,
    #[account(
        mut,
        seeds = [AGENT_SEED, agent.authority.as_ref()],
        bump = agent.bump,
        address = job.agent @ VeilError::Unauthorized
    )]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// CHECK: escrow authority PDA that owns the vault.
    #[account(seeds = [ESCROW_AUTH_SEED, job.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = job.creator,
    )]
    pub creator_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
