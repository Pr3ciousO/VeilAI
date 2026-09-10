use crate::errors::VeilError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;

/// One Ed25519 precompile signature-offsets record starts after
/// [num_signatures:u8][padding:u8]. See the Solana Ed25519 program format.
const SIGNATURE_OFFSETS_START: usize = 2;
const U16: usize = 2;

fn read_u16(data: &[u8], at: usize) -> Result<usize> {
    let bytes: [u8; 2] = data
        .get(at..at + U16)
        .ok_or(VeilError::QuoteInvalid)?
        .try_into()
        .map_err(|_| VeilError::QuoteInvalid)?;
    Ok(u16::from_le_bytes(bytes) as usize)
}

/// The (pubkey, message, signature) triple the Ed25519 precompile cryptographically verified.
pub struct VerifiedEd25519 {
    pub pubkey: [u8; 32],
    pub message: Vec<u8>,
    pub signature: [u8; 64],
}

/// Extract the triple the Ed25519 precompile verified at `ix_index`. The
/// precompile has already checked the signature is valid for (pubkey, message);
/// this returns *what* it verified so the caller can compare it to expectations.
/// Errors only on a missing/malformed/non-self-contained precompile instruction.
pub fn extract_verified_ed25519(
    instructions_sysvar: &AccountInfo,
    ix_index: usize,
) -> Result<VerifiedEd25519> {
    let ix = load_instruction_at_checked(ix_index, instructions_sysvar)
        .map_err(|_| VeilError::QuoteInvalid)?;
    require_keys_eq!(ix.program_id, ed25519_program::ID, VeilError::QuoteInvalid);

    let data = &ix.data;
    let num_sigs = *data.first().ok_or(VeilError::QuoteInvalid)?;
    require!(num_sigs == 1, VeilError::QuoteInvalid);

    let sig_off = read_u16(data, SIGNATURE_OFFSETS_START)?;
    let sig_ix_idx = read_u16(data, SIGNATURE_OFFSETS_START + U16)?;
    let pk_off = read_u16(data, SIGNATURE_OFFSETS_START + 2 * U16)?;
    let pk_ix_idx = read_u16(data, SIGNATURE_OFFSETS_START + 3 * U16)?;
    let msg_off = read_u16(data, SIGNATURE_OFFSETS_START + 4 * U16)?;
    let msg_size = read_u16(data, SIGNATURE_OFFSETS_START + 5 * U16)?;
    let msg_ix_idx = read_u16(data, SIGNATURE_OFFSETS_START + 6 * U16)?;

    // All referenced data must live in this same instruction (index 0xFFFF).
    const SELF: usize = u16::MAX as usize;
    require!(
        sig_ix_idx == SELF && pk_ix_idx == SELF && msg_ix_idx == SELF,
        VeilError::QuoteInvalid
    );

    let pk: [u8; 32] = data
        .get(pk_off..pk_off + 32)
        .ok_or(VeilError::QuoteInvalid)?
        .try_into()
        .map_err(|_| VeilError::QuoteInvalid)?;
    let sig: [u8; 64] = data
        .get(sig_off..sig_off + 64)
        .ok_or(VeilError::QuoteInvalid)?
        .try_into()
        .map_err(|_| VeilError::QuoteInvalid)?;
    let msg = data
        .get(msg_off..msg_off + msg_size)
        .ok_or(VeilError::QuoteInvalid)?
        .to_vec();

    Ok(VerifiedEd25519 {
        pubkey: pk,
        message: msg,
        signature: sig,
    })
}
