use crate::constants::*;
use crate::errors::VeilError;
use crate::state::Agent;
use anchor_lang::prelude::*;

pub fn handler(
    ctx: Context<RegisterAgent>,
    model_id: String,
    expected_measurement: [u8; MEASUREMENT_LEN],
    quoting_key: [u8; 32],
    price: u64,
) -> Result<()> {
    require!(model_id.len() <= MAX_MODEL_ID_LEN, VeilError::ModelIdTooLong);

    let agent = &mut ctx.accounts.agent;
    agent.authority = ctx.accounts.authority.key();
    agent.model_id = model_id;
    agent.expected_measurement = expected_measurement;
    agent.quoting_key = quoting_key;
    agent.price = price;
    agent.completed = 0;
    agent.verified = 0;
    agent.rejected = 0;
    agent.reputation = 10_000; // start at 100.00%
    agent.bump = ctx.bumps.agent;

    msg!("VeilAI: registered agent {}", agent.authority);
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = Agent::SPACE,
        seeds = [AGENT_SEED, authority.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
