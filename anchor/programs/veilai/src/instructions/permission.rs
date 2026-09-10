use crate::constants::*;
use crate::errors::VeilError;
use crate::state::Job;
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::{
    CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi,
};
use ephemeral_rollups_sdk::access_control::structs::{EphemeralMembersArgs, Member, PERMISSION_SEED};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};

/// Create the job's EphemeralPermission on the ER, gating access to the given
/// members (creator + provider). Idempotent: retries are safe.
pub fn init_permission(ctx: Context<PermissionContext>, members: Vec<Member>) -> Result<()> {
    require!(
        members.len() <= MAX_PERMISSION_MEMBERS,
        VeilError::TooManyMembers
    );

    if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID
        && !ctx.accounts.permission.data_is_empty()
    {
        return Ok(());
    }

    let job_id_bytes = ctx.accounts.job.job_id.to_le_bytes();
    let creator = ctx.accounts.job.creator;
    let bump = ctx.accounts.job.bump;
    let signer_seeds: &[&[u8]] = &[JOB_SEED, creator.as_ref(), &job_id_bytes, &[bump]];

    CreateEphemeralPermissionCpi {
        payer: ctx.accounts.job.to_account_info(),
        permissioned_account: ctx.accounts.job.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: true,
            members,
        },
    }
    .invoke_signed(&[signer_seeds])?;

    Ok(())
}

/// Replace the full member list. Omitting a member revokes it, so always include
/// every member that must retain access.
pub fn set_permission(
    ctx: Context<PermissionContext>,
    is_private: bool,
    members: Vec<Member>,
) -> Result<()> {
    require!(
        members.len() <= MAX_PERMISSION_MEMBERS,
        VeilError::TooManyMembers
    );

    let job_id_bytes = ctx.accounts.job.job_id.to_le_bytes();
    let creator = ctx.accounts.job.creator;
    let bump = ctx.accounts.job.bump;
    let signer_seeds: &[&[u8]] = &[JOB_SEED, creator.as_ref(), &job_id_bytes, &[bump]];

    UpdateEphemeralPermissionCpi {
        payer: ctx.accounts.job.to_account_info(),
        permissioned_account: ctx.accounts.job.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        authority: ctx.accounts.job.to_account_info(),
        authority_is_signer: false,
        args: EphemeralMembersArgs { is_private, members },
    }
    .invoke_signed(&[signer_seeds])?;

    Ok(())
}

/// Close the permission (refunds its rent to the Job PDA) before undelegation.
pub fn close_permission(ctx: Context<PermissionContext>) -> Result<()> {
    let job_id_bytes = ctx.accounts.job.job_id.to_le_bytes();
    let creator = ctx.accounts.job.creator;
    let bump = ctx.accounts.job.bump;
    let signer_seeds: &[&[u8]] = &[JOB_SEED, creator.as_ref(), &job_id_bytes, &[bump]];

    CloseEphemeralPermissionCpi {
        payer: ctx.accounts.job.to_account_info(),
        permissioned_account: ctx.accounts.job.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        authority: ctx.accounts.job.to_account_info(),
        authority_is_signer: false,
    }
    .invoke_signed(&[signer_seeds])?;

    Ok(())
}

#[derive(Accounts)]
pub struct PermissionContext<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [JOB_SEED, job.creator.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump,
        has_one = creator @ VeilError::Unauthorized
    )]
    pub job: Account<'info, Job>,
    /// CHECK: Derived and checked under the Permission Program.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, job.key().as_ref()],
        bump,
        seeds::program = permission_program.key()
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission Program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: Ephemeral vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}
