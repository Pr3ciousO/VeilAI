# VeilAI — Build Plan

> Private, verifiable execution infrastructure for AI agents.
> Tracking doc for the MagicBlock hackathon build. Tick tasks as we complete them.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · 🔴 P0 (must ship) · 🟠 P1 (should) · 🟢 P2 (later)

---

## Stack (locked)

| Layer | Tech |
| --- | --- |
| Program | Rust + Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2 (`anchor` + `access-control`) |
| Backend | Node.js + Express + TypeScript + **Supabase** (Postgres) for job/agent persistence |
| Frontend | Next.js (latest, App Router) + Tailwind + Framer Motion + HugeIcons |
| Auth/Wallet | **Privy** — custom login UI (email, Google, X), **not** the default modal |
| Design | **Space Grotesk**, liquid-glass surfaces, rounded-full pills, motion throughout; dark palette (below) |
| Shared | TypeScript package (types, commitment/crypto helpers, IDL) |
| Chain | Solana devnet + MagicBlock PER (devnet) |
| Payments | Program-owned USDC escrow vault (core) + MagicBlock Private Payments API (privacy, P1) |

### Key design decisions (locked)
- **Escrow is program-controlled**, not the hosted API, so release/refund is gated by our onchain `verify_attestation` result. The Private Payments API wraps the *payout leg* for amount privacy (P1). This keeps "proof before payment" enforced by our program, not a third-party service.
- **Attestation is abstracted behind an interface.** MVP ships a **stub enclave** that emits an ed25519-signed quote in the real TDX field layout; `verify_attestation` runs the genuine two-step check (quote signature + report-data binding + measurement allowlist). Swapping the stub for real TDX changes zero onchain code.
- **PER pattern:** delegate only the data PDA on base; create/update/close its `EphemeralPermission` on the ER. Pre-fund the data PDA for permission rent before delegation.
- **Settlement** runs via a post-commit **Magic Action** on `commit_and_undelegate`; the settle handler authenticates via the injected `escrow` signer and is idempotent.

---

## Design system (frontend)

**Font:** Space Grotesk (all weights). **Language:** liquid glass (translucent, blurred surfaces with hairline borders + inner glow), **rounded-full pills** for buttons/badges/inputs, motion on every state change (Framer Motion — enter/exit, hover, status transitions).

**Color tokens** (define as CSS variables + Tailwind theme in `frontend/`):

| Token | Hex | Use |
| --- | --- | --- |
| `void` | `#030404` | Deepest recess, box-shadow tint, absolute dark accent |
| `onyx` | `#08090a` | Page background, primary surface |
| `carbon` | `#141516` | Elevated card, input field, subtle surface layer |
| `graphite` | `#1c1c1f` | Mid-elevation panels, nested surfaces |
| `smoke` | `#23252a` | Hover state, deeper card, button surface tone |
| `iron` | `#2d2e31` | Pressed/active surface, highest tier elevation |
| `ash` | `#34343a` | Primary hairline border — dividers, rows, separators |
| `ferrite` | `#3e3e44` | Inner shadow stroke, focus-adjacent borders, 1px outlines |
| `steel` | `#62666d` | Tertiary text, muted icon, low-emphasis helper |
| `pewter` | `#7f7f80` | Disabled text, placeholder-tier secondary |
| `fog` | `#8a8f98` | Muted body, metadata, timestamps, nav sub-items |
| `mist` | `#d0d6e0` | Secondary text, descriptions, list body |
| `chalk` | `#e4e5e9` | Light icon accent, rare light dividers |
| `snow` | `#f7f8f8` | Primary text, headings, logo, pill border — the only near-white |

Rules: dark-first (no light theme). Elevation climbs onyx → carbon → graphite → smoke → iron. Borders use ash/ferrite only. Text hierarchy snow → mist → fog → steel → pewter. Glass surfaces = translucent carbon/graphite + backdrop-blur + ash hairline + subtle void shadow.

---

## Repo layout (target)

```
VeilAI/
├── anchor/                 # Anchor workspace
│   ├── programs/veilai/     # the on-chain program
│   ├── tests/               # ts-mocha integration tests
│   └── Anchor.toml
├── backend/                # Express + TS
│   ├── src/db/              # Supabase client + schema/migrations
│   ├── src/orchestrator/    # job lifecycle driver (delegation, PER, commit, settle)
│   ├── src/provider/        # the AI agent (calls model, requests attestation)
│   ├── src/enclave/         # stub TEE: decrypt → run model → emit ed25519 quote
│   ├── src/attestation/     # quote build/parse helpers (shared format)
│   └── src/routes/          # REST API for the frontend
├── frontend/               # Next.js app
│   ├── app/                 # App Router pages
│   ├── components/ui/       # GlassCard, PillButton, PillInput, StatusChip … (liquid glass)
│   ├── components/auth/     # Privy custom login (email + Google + X)
│   └── lib/                 # api client, privy config, palette tokens
├── shared/                 # TS: types, commitment + crypto (x25519/ed25519), IDL, program IDs
└── plan.md / prd.md
```

---

# Phase 0 — Foundations & Tooling 🔴

**Goal:** monorepo scaffolded, toolchains verified, everyone builds green.

- [x] Confirm toolchain versions: Rust 1.89.0, Solana CLI 4.2.2, Node 24.16, pnpm 12.3.4 (Anchor 1.0.2 installing)
- [x] Init monorepo (pnpm workspaces) with `backend/`, `frontend/`, `shared/` (`anchor/` in Phase 1)
- [x] Root `.gitignore`, `.env.example`, `README.md`, `.editorconfig`, `.prettierrc`
- [x] Create devnet keypairs (deployer + provider) in `wallets/` (gitignored); funding pending (airdrop rate-limited)
- [x] Add root scripts: `build`, `test`, `dev`, `lint`, `format` + `anchor:*` fanning out to workspaces
- [x] Pin MagicBlock endpoints in `.env.example` (base RPC, router, ER fqdn placeholder)
- [x] Decide devnet USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) and record in `shared/src/config.ts`
- [x] `shared/` package built: types, config, commitment, x25519/ed25519 crypto, attestation codec ✅ builds green
- [x] `backend/` skeleton (Express health server) ✅ builds green
- [x] `frontend/` scaffolded (Next.js 16 + Tailwind 4 + Framer + HugeIcons + wallet adapter) ✅ builds green
- [x] Anchor workspace scaffolded (`anchor/` with `programs/veilai`) + `ping` skeleton → **`anchor build` green**, SDK 0.16.2 compiles, `veilai.so` + IDL produced
- [ ] Fund deployer on devnet (retry airdrop / faucet)
- [ ] Verify local MagicBlock stack runs: `npx --package=@magicblock-labs/ephemeral-validator mb-stack`
- [ ] Add shared eslint flat config (lint scripts wired, config pending — non-blocking)

> **Toolchain notes (hard-won):** Rust must be **1.98.1** (stable), not 1.89 — Anchor/avm deps need ≥1.91. Install avm from **git unlocked** (`cargo install --git …anchor avm`), not `--locked` (pinned `openssl-sys` fails against brew OpenSSL 3.6). Solana pinned to **3.1.10** (Anchor 1.0.2's recommended; matches MagicBlock known-good). `OPENSSL_DIR`/`PKG_CONFIG_PATH` → brew openssl@3 for native builds.

---

# Phase 1 — Solana Program: Core Job Lifecycle 🔴

**Goal:** create/escrow/track a job on base layer with all state and guards. No MagicBlock yet.

- [x] Anchor workspace + `Cargo.toml` deps (anchor-lang 1.0.2 `init-if-needed`, anchor-spl 1.0.2, ephemeral-rollups-sdk 0.16.2 `["anchor","access-control"]`)
- [x] `#[ephemeral]` before `#[program]`
- [x] Define `Agent` account: `authority`, `model_id`, `expected_measurement [u8;48]`, `quoting_key [u8;32]`, `price`, counters (`completed`/`verified`/`rejected`), `reputation` (bps) — `state.rs`
- [x] Define `Job` account: `job_id`, `creator`, `agent`, `status` enum (`Created|Escrowed|Executing|Verified|Rejected|Settled`), `attestation_status`, `budget`, `created_at`, `prompt_ciphertext_commitment`, `input_commitment`, `output_commitment`, `expected_measurement`, `quoting_key`, `model_id`, `nonce`, `settlement_id` — `state.rs`
- [x] `register_agent` — provider registers with measurement + quoting key + price (allowlist entry)
- [x] `create_job` — init Job PDA, commitments + nonce, status `Created`; seeds `["job", creator, job_id_le]`
- [x] Pre-fund Job PDA for `EphemeralPermission::size_of(MAX_PERMISSION_MEMBERS)` rent during creation
- [x] `deposit_escrow` — USDC from creator ATA → program-owned escrow vault ATA (PDA `["escrow-auth", job]` authority), status → `Escrowed`
- [x] `errors.rs` — full `VeilError` set (Unauthorized, BadStatus, TooManyMembers, MeasurementMismatch, QuoteInvalid, QuotingKeyMismatch, ReportDataMismatch, InvalidDelegationRecord, AlreadySettled, ModelIdTooLong, InvalidBudget)
- [x] Status transition guards on every instruction
- [x] Tests (ts-mocha vs local `solana-test-validator` — `scripts/test-local.sh`): **5 passing** — register_agent, create_job, deposit_escrow, bad-status + zero-budget rejections

> **Note:** Anchor 1.x's `anchor test` uses **surfpool** (needs a Command Line Tools update we skipped). We run tests via `anchor/scripts/test-local.sh` (spins `solana-test-validator`, deploys, runs ts-mocha). Also fixed: Anchor 1.x `CpiContext::new(program_id: Pubkey, …)` (not AccountInfo), and `idl-build` must include `anchor-spl/idl-build`.

---

# Phase 2 — MagicBlock PER Integration 🔴

**Goal:** job state goes private inside the TEE-backed ER, gated to `[user, provider]`.

- [x] Import delegation/access-control SDK (`delegate, ephemeral`; `Create/Update/CloseEphemeralPermissionCpi`; consts)
- [x] `delegate_job` (base) — `#[delegate]` context, `del` constraint on Job PDA, forward optional TEE `validator` in `DelegateConfig` — `delegate_job.rs`
- [x] `init_permission` (ER) — idempotent `CreateEphemeralPermissionCpi`, members arg, `is_private = true`, cap at `MAX_PERMISSION_MEMBERS` — `permission.rs`
- [x] `set_permission` (ER) — `UpdateEphemeralPermissionCpi`, rebuild full member list
- [x] `close_permission` (ER) — `CloseEphemeralPermissionCpi` before undelegate
- [x] Shared `PermissionContext` (permission PDA under `PERMISSION_PROGRAM_ID`, vault, magic program) — `has_one = creator` app auth rule
- [x] `execute_marker` (ER) — provider marks status `Executing` (auth: `has_one = provider`, stored on Job)
- [x] Added `provider` field to `Job` for ER-side auth without reading the (non-delegated) agent
- [x] **Phase 2 builds green** (SDK PER APIs compile); Phase 1 tests still 5 passing
- [ ] ⏳ Integration test (devnet): init on base → delegate on base → verify router `getDelegationStatus` + owners → create permission on ER → confirm privacy boundary — **blocked on devnet funding**

---

# Phase 3 — Attestation & On-chain Verification 🔴

**Goal:** the innovation — honest verification that a valid quote from the right workload produced the output.

### Attestation format (shared)
- [ ] Define quote struct in `shared/`: `{ report_data[64], mrtd[48], rtmr[...], signature[64], quoting_key[32] }` matching TDX field layout
- [ ] Define `report_data = sha256(input_commitment ‖ output_commitment ‖ model_id ‖ nonce)`
- [ ] Document the abstraction boundary (stub ed25519 now ↔ real TDX DCAP later)

### Program: `verify_attestation` (ER)
- [ ] Accept quote bytes + job; recompute expected `report_data` from stored commitments + nonce
- [ ] **Check 1 — quote signature:** verify ed25519 signature over `report_data` by `quoting_key` (via Ed25519 precompile + instructions-sysvar introspection)
- [ ] **Check 2 — quoting key allowlisted:** `quoting_key == agent.quoting_key`
- [ ] **Check 3 — measurement allowlist:** `mrtd == agent.expected_measurement` (the step MagicBlock's helper skips)
- [ ] **Check 4 — binding:** recomputed `report_data == quote.report_data`
- [ ] On all pass → status `Verified`, store `output_commitment`; else → `Rejected`
- [ ] Emit `AttestationVerified` / `AttestationRejected` events
- [ ] Tests: valid quote passes; tampered output → reject; wrong measurement → reject; wrong key → reject; replayed nonce → reject

---

# Phase 4 — Settlement via Magic Actions 🔴

**Goal:** escrow releases to provider on verify, refunds on reject — automatically after commit.

- [ ] `settle_payment` `#[action]` handler — transfer USDC from escrow vault to provider ATA, bump reputation, status `Settled`
- [ ] **Auth:** require injected `escrow` as `signer`, pinned to `ephemeral_balance_pda_from_payer(escrow_auth, 255)` (NOT just `address = crate::ID`)
- [ ] **Idempotency:** guard on `Job.settlement_id`; refuse double-settle (`AlreadySettled`)
- [ ] `refund_escrow` path for `Rejected` jobs (creator gets funds back)
- [ ] `commit_and_settle` (ER) — `MagicIntentBundleBuilder … .commit_and_undelegate(job) .add_post_commit_actions([settle_or_refund]) .build_and_invoke()`
- [ ] Include destination program in outer commit context; set `is_writable` correctly per action account
- [ ] Handle commit fee limits (re-delegate to reset nonce, or `magic_fee_vault` for high frequency)
- [ ] Model `settling` vs `settled`; observe base-layer effect before marking paid (don't trust ER sig alone)
- [ ] Tests: verified → paid; rejected → refunded; action-dropped-on-retry recovery; direct-call attack on handler rejected

---

# Phase 5 — Backend (Node + Express + TypeScript) 🔴

**Goal:** orchestrate the full lifecycle and run the provider/enclave; expose REST for the frontend.

### 5a. Shared + client plumbing
- [ ] `shared/`: export IDL, program IDs, USDC mint, endpoints, quote codec, commitment helpers
- [ ] Crypto helpers: x25519 (encrypt prompt to enclave), ed25519 (stub quoting key), sha256 commitments
- [ ] Anchor client wrapper with **dual connections** (base + ER); router `getDelegationStatus` → `fqdn`

### 5b. Supabase persistence
- [ ] Supabase project + service-role key (server-side only) in env
- [ ] `@supabase/supabase-js` client wrapper (`backend/src/db/`)
- [ ] Schema/migrations: `agents`, `jobs`, `job_events` (audit trail), `attestations`, `enclave_outputs` (ciphertext refs)
- [ ] Chain is source of truth for money/status; Supabase mirrors + indexes for fast UI reads and off-chain data (ciphertext, output refs, metadata, capabilities)
- [ ] Realtime: expose job status changes via Supabase Realtime (or backend SSE) to the frontend

### 5c. Orchestrator service
- [ ] Job state machine mirroring on-chain status; persist transitions to `job_events`
- [ ] Route delegation tx → base; ER ops → ER; use `GetCommitmentSignature` then confirm on base
- [ ] Poll delegation status/ownership with bounded timeout before ER ops
- [ ] Trigger `commit_and_settle` after verification; reconcile action delivery

### 5d. Provider agent
- [ ] Authenticate to Private ER (challenge → login → bearer token) to read private job
- [ ] Pull job, hand ciphertext to enclave, submit resulting attestation via `verify_attestation`

### 5e. Stub enclave (clearly labeled)
- [ ] Decrypt prompt (x25519) → call LLM (Claude via Anthropic API; key in env) → produce output
- [ ] Encrypt output to user's key; compute input/output commitments
- [ ] Emit ed25519-signed quote with fixed `mrtd` = registered measurement, in TDX field layout
- [ ] Clear "STUB ENCLAVE" labeling in logs/responses

### 5f. REST API (for frontend)
- [ ] `POST /agents` (register), `GET /agents`, `GET /agents/:id`
- [ ] `POST /jobs` (create+delegate+permission+escrow orchestration), `GET /jobs`, `GET /jobs/:id`
- [ ] `POST /jobs/:id/execute` (kick provider), status polling endpoint / SSE for live updates
- [ ] `GET /jobs/:id/result` (returns decryptable output ref for creator)
- [ ] Input validation (zod), error handling, CORS, rate limit

---

# Phase 6 — Frontend (Next.js + Tailwind + Framer + HugeIcons) 🔴

**Goal:** the polished lifecycle the judges see: Submit → Verifying → Verified → Paid — in a liquid-glass, Space Grotesk UI.

### 6a. Setup & design system
- [x] `create-next-app` (App Router, TS, Tailwind) — scaffolded in Phase 0 (Framer Motion, HugeIcons, wallet-adapter installed)
- [ ] Load **Space Grotesk** (next/font) as the global font
- [ ] Wire the **color palette** as CSS variables + Tailwind theme tokens (`void…snow`, see Design System)
- [ ] Build the liquid-glass primitive components: `GlassCard`, `PillButton` (rounded-full), `PillInput`, `Badge`, `StatusChip`, `Toast` — with motion baked in
- [ ] Layout shell, nav, toast system; global backdrop-blur + void shadow treatment
- [ ] API client to backend; devnet config

### 6b. Auth — Privy (custom UI, not the default modal)
- [ ] Integrate `@privy-io/react-auth`; configure app id; disable the default login modal
- [ ] Custom login screen: email input (pill) + **Google** and **X** social buttons (HugeIcons social icons), all in our glass/pill style
- [ ] Embedded/linked Solana wallet via Privy for signing devnet txns
- [ ] Session/user context; sign-out; gate app routes on auth

### 6c. Screens
- [ ] **Landing** with the pitch + tagline + custom login
- [ ] **Create Private Job** — task, agent type, budget, verification badge; client-side prompt encryption before submit
- [ ] **Agent catalog / profile** — measurement, price, live reputation, verification rate
- [ ] **Job dashboard** — table (job, agent, status, cost) with live status (Supabase Realtime/SSE)
- [ ] **Job detail** — redacted private task, status checklist (Escrowed→Executed→Attested→Verified→Settled), commitments, Solana settlement link
- [ ] **Verification screen** — 🟡 Verifying… → ✅ VERIFIED showing *both* checks (quote valid + measurement allowlisted)

### 6d. Motion & polish
- [ ] Framer transitions for status changes; "prompt disappears into private state" animation
- [ ] Explorer-comparison component (naive memo vs VeilAI commitment) for the reveal
- [ ] Loading/skeleton states; empty states; error states; consistent pill + glass motion

---

# Phase 7 — Integration & E2E 🔴

**Goal:** one reproducible run, start to finish, on devnet.

- [ ] Wire frontend → backend → program → PER → settle, happy path green on devnet
- [ ] E2E script: create → delegate → permission → escrow → execute → attest → verify → commit+settle
- [ ] **INVALID path** E2E: tampered output → `Rejected` → escrow refunded (the demo money-shot)
- [ ] Reputation updates reflected in agent profile from real runs
- [ ] Latency budget: measure and tune to ≤60s creation→verified
- [ ] Test gates per skill: program-logic test, delegation lifecycle test, ownership assertions, one retry/propagation test, Magic Action delivery test, payments test
- [ ] Record a backup happy-path run (screen capture) for demo safety

---

# Phase 8 — Demo Polish & Submission 🔴

**Goal:** win the room.

- [ ] Seed one real agent (ResearchBot) with genuine measurement; verify profile shows live stats
- [ ] Rehearse the 3-min demo script (PRD §19), including the INVALID reveal
- [ ] Pre-warm ER/validator; prepare fallback recording
- [ ] Write submission README: architecture diagram, two-TEE model, what's real vs stubbed (honesty slide)
- [ ] Deploy frontend (Vercel) + backend (Railway/Render); publish devnet program ID
- [ ] Short architecture explainer / pitch deck (privacy hook, verification innovation, business model)

---

# P1 — Should Have (if MVP lands early) 🟠

- [ ] Multiple agents (CodeBot, DataBot), each with own measurement + catalog
- [ ] Agent discovery: filter by price/category/reputation/latency
- [ ] Private payout leg via Private Payments API (`/v1/spl/transfer`, split/delay for amount privacy)
- [ ] Richer reputation model (latency, dispute-free streak)
- [ ] Swap stub enclave for a real TDX enclave (no onchain change) — even a minimal one

# P2 — Future 🟢

- [ ] Provider staking + slashing
- [ ] Multi-provider redundant verification (quorum)
- [ ] Dispute system
- [ ] Agent-to-agent tasks
- [ ] Enterprise API / SDK for marketplaces to integrate VeilAI

---

## Correctness watchlist (carry through every phase)

- Delegate on **base**, operate/commit/undelegate on **ER** — never cross them.
- Delegation status is routing, **not** authorization; enforce app-level signer/authority on ER too.
- `#[action]` handlers authenticate via the **escrow signer**, not `address = crate::ID`.
- Settlement is async: ER signature ≠ settled; observe the base effect; idempotency keys on all economic actions.
- Never overclaim privacy — the attested enclave sees the prompt by design; the operator and public do not.
- Keep the stub enclave **clearly labeled** everywhere it appears.
