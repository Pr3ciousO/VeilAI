-- VeilAI Supabase schema.
-- The chain is the source of truth for money/status; these tables mirror on-chain
-- state for fast UI reads and hold OFF-CHAIN data (ciphertext, refs, metadata).
-- Run in the Supabase SQL editor (or via the CLI migrations).

-- ─── Agents (mirror of on-chain Agent + display metadata) ───────────────
create table if not exists agents (
  id                    text primary key,           -- agent PDA (base58)
  authority             text not null,              -- provider wallet
  name                  text not null,
  description           text,
  model_id              text not null,
  expected_measurement  text not null,              -- hex MRTD (allowlisted)
  quoting_key           text not null,              -- base58 ed25519 pubkey
  price                 bigint not null,            -- USDC base units
  capabilities          text[] not null default '{}',
  completed             bigint not null default 0,
  verified              bigint not null default 0,
  rejected              bigint not null default 0,
  reputation            integer not null default 10000, -- bps
  avg_latency_ms        integer,
  created_at            timestamptz not null default now()
);

-- ─── Jobs (mirror of on-chain Job + off-chain refs) ─────────────────────
do $$ begin
  create type job_status as enum
    ('Created', 'Escrowed', 'Executing', 'Verified', 'Rejected', 'Settled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type attestation_status as enum
    ('None', 'Submitted', 'Verified', 'Rejected');
exception when duplicate_object then null; end $$;

create table if not exists jobs (
  id                          text primary key,     -- job PDA (base58)
  job_id                      bigint not null,      -- on-chain u64
  creator                     text not null,        -- creator wallet
  agent_id                    text not null references agents(id),
  provider                    text not null,        -- provider wallet
  title                       text,                 -- display label (non-sensitive)
  status                      job_status not null default 'Created',
  attestation_status          attestation_status not null default 'None',
  budget                      bigint not null,      -- USDC base units
  -- Commitments / crypto material (public):
  prompt_ciphertext_commitment text not null,       -- hex
  input_commitment            text not null,        -- hex
  output_commitment           text,                 -- hex (set on verify)
  expected_measurement        text not null,        -- hex
  nonce                       text not null,        -- hex
  settlement_id               text not null,        -- hex
  settled                     boolean not null default false,
  -- Off-chain confidential material (encrypted; never plaintext):
  prompt_ciphertext           jsonb,                -- SealedBox to enclave
  output_ciphertext           jsonb,                -- SealedBox to creator
  output_recipient_pubkey     text,                 -- x25519 pubkey the output was sealed to
  attestation_checks          jsonb,                -- per-check verifier results (AttestationCheck[])
  attestation_quote           jsonb,                -- the quote those checks ran against
  settlement_tx               text,                 -- solana signature
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ─── Job event audit trail (state machine transitions) ──────────────────
create table if not exists job_events (
  id          bigserial primary key,
  job_id      text not null references jobs(id),
  kind        text not null,            -- created|escrowed|delegated|executing|attested|verified|rejected|settled|refunded
  detail      jsonb,
  signature   text,                     -- related solana signature, if any
  created_at  timestamptz not null default now()
);

-- Additive migrations for databases created before the column existed
-- (`create table if not exists` above is a no-op once the table is there).
alter table jobs add column if not exists output_recipient_pubkey text;
alter table jobs add column if not exists attestation_checks jsonb;
alter table jobs add column if not exists attestation_quote jsonb;
-- On-chain provenance: PDA + the signature for each lifecycle transaction.
alter table jobs add column if not exists job_pda text;
alter table jobs add column if not exists on_chain_creator text;
alter table jobs add column if not exists create_tx text;
alter table jobs add column if not exists escrow_tx text;
alter table jobs add column if not exists execute_tx text;
alter table jobs add column if not exists verify_tx text;
alter table jobs add column if not exists on_chain_reason text;

create index if not exists jobs_creator_idx on jobs(creator);
create index if not exists jobs_agent_idx on jobs(agent_id);
create index if not exists jobs_status_idx on jobs(status);
create index if not exists job_events_job_idx on job_events(job_id);

-- updated_at trigger
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists jobs_touch on jobs;
create trigger jobs_touch before update on jobs
  for each row execute function touch_updated_at();
