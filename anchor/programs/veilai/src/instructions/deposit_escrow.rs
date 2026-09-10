use crate::constants::*;
use crate::errors::VeilError;
use crate::state::{Job, JobStatus};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

pub fn handler(ctx: Context<DepositEscrow>) -> Result<()> {
    let job = &ctx.accounts.job;
    require!(job.status == JobStatus::Created, VeilError::BadStatus);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.creator_ata.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        job.budget,
        ctx.accounts.usdc_mint.decimals,
    )?;

    ctx.accounts.job.status = JobStatus::Escrowed;
    msg!("VeilAI: escrowed {} for job #{}", ctx.accounts.job.budget, ctx.accounts.job.job_id);
    Ok(())
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(
        mut,
        seeds = [JOB_SEED, creator.key().as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump,
        has_one = creator @ VeilError::Unauthorized
    )]
    pub job: Account<'info, Job>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = creator,
    )]
    pub creator_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the escrow vault; signs transfers out in Phase 4.
    #[account(seeds = [ESCROW_AUTH_SEED, job.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
