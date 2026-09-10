use anchor_lang::prelude::*;

/// PDA seed prefixes — mirrored in `shared/src/config.ts`.
#[constant]
pub const AGENT_SEED: &[u8] = b"agent";
#[constant]
pub const JOB_SEED: &[u8] = b"job";
#[constant]
pub const ESCROW_AUTH_SEED: &[u8] = b"escrow-auth";

/// Max members on a job's EphemeralPermission (creator + provider, with headroom).
pub const MAX_PERMISSION_MEMBERS: usize = 4;

/// Bounded string length for a model identifier.
pub const MAX_MODEL_ID_LEN: usize = 32;

/// TEE measurement (MRTD) length in bytes.
pub const MEASUREMENT_LEN: usize = 48;
