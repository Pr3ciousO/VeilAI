use anchor_lang::prelude::*;

#[error_code]
pub enum VeilError {
    #[msg("Caller is not authorized for this action")]
    Unauthorized,
    #[msg("Job is not in the required status for this action")]
    BadStatus,
    #[msg("Permission member count exceeds MAX_PERMISSION_MEMBERS")]
    TooManyMembers,
    #[msg("Enclave measurement does not match the agent allowlist")]
    MeasurementMismatch,
    #[msg("Attestation quote is invalid")]
    QuoteInvalid,
    #[msg("Quoting key is not allowlisted for this agent")]
    QuotingKeyMismatch,
    #[msg("Report data binding does not match the job commitments")]
    ReportDataMismatch,
    #[msg("Delegation record is malformed")]
    InvalidDelegationRecord,
    #[msg("Job has already been settled")]
    AlreadySettled,
    #[msg("Model identifier is too long")]
    ModelIdTooLong,
    #[msg("Budget must be greater than zero")]
    InvalidBudget,
}
