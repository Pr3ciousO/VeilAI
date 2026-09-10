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
- [x] Quote struct in `shared/` (`AttestationQuote`): `{ reportData, mrtd[48], rtmr, signature[64], quotingKey }` — TDX-shaped
- [x] `report_data = sha256(input ‖ output ‖ model_id ‖ nonce)`; **signed message = sha256(report_data ‖ mrtd)** so the measurement is cryptographically bound to the signature (not an unsigned claim)
- [x] `buildQuote` / `verifyQuote` / `quoteSignedMessage` helpers; abstraction boundary documented (stub ed25519 ↔ real TDX DCAP)

### Program: `verify_attestation`
- [x] Recompute `report_data` + `signed_message` on-chain from stored commitments + submitted output (sha2 crate)
- [x] **Ed25519 precompile introspection** (`ed25519.rs`): confirm the tx's Ed25519 instruction verified our exact (quoting_key, signed_message, signature) triple — precompile does the crypto, we confirm the *right* triple
- [x] **Quoting key allowlist:** verified key == `job.quoting_key`
- [x] **Measurement allowlist:** `mrtd == job.expected_measurement` (the step MagicBlock's helper skips)
- [x] **Binding:** signed message == recomputed `sha256(report_data ‖ mrtd)` (tampered output ⇒ mismatch)
- [x] All pass → `Verified` (+ store `output_commitment`); else → **persisted `Rejected`** (so settlement can refund) — no tx abort on bad-but-signed quotes
- [x] Emit `AttestationVerified` / `AttestationRejected` events
- [x] Tests (**3 passing**, real Ed25519 precompile): valid → Verified; tampered output → Rejected; wrong measurement → Rejected. Full suite **8 passing**.

---

# Phase 4 — Settlement via Magic Actions 🔴

**Goal:** escrow releases to provider on verify, refunds on reject — automatically after commit.

- [x] `settle_payment_direct` / `refund_escrow_direct` — shared `do_settle`/`do_refund` fns; USDC escrow → provider (verified) or creator (rejected); bump reputation; status `Settled` — `settlement.rs`
- [x] **Idempotency:** `Job.settled` flag guards double-settle (`AlreadySettled`); status guards (`Verified`→settle, `Rejected`→refund)
- [x] Escrow vault authority is the `["escrow-auth", job]` PDA, signs transfers via seeds; caller must be provider or creator
- [x] Fixed BPF stack-frame overflow by `Box`-ing token accounts + passing mint as `AccountInfo`+decimals
- [x] Tests (**2 passing**): verified → provider paid (balance asserted); rejected → creator refunded. Full suite **10 passing**.
- [ ] ⏳ Magic Action auto-settle: `settle_payment`/`refund_escrow` `#[action]` entrypoints (escrow-signer auth) + `commit_and_settle` ER (`MagicIntentBundleBuilder.commit_and_undelegate + add_post_commit_actions`) — **deferred to devnet integration** (Magic Actions only run on the ER; two-entrypoint pattern over the shared fn, per skill guidance). Direct path above is the robust fallback the demo relies on.

> **Phase 4 decision:** the economic guarantee (proof-before-payment: verified→paid, rejected→refunded, idempotent) is fully implemented and locally tested via the direct Signer-authorized entrypoints. The *auto-settle-on-commit* Magic Action is a delivery mechanism layered on top; it's wired during live devnet integration (Phase 7) since it can't be exercised without a real Ephemeral Rollup.

---

# Phase 5 — Backend (Node + Express + TypeScript) 🔴

**Goal:** orchestrate the full lifecycle and run the provider/enclave; expose REST for the frontend.

### 5a. Shared + client plumbing
- [x] `shared/`: config (program IDs, USDC mint, endpoints, seeds), types, commitment + crypto helpers
- [x] Crypto helpers: x25519 seal/open (prompt↔enclave, output↔user), ed25519 sign/verify + `edPublicFromSecret`, sha256 commitments, `computeReportData`/`computeSignedMessage`
- [ ] Anchor client wrapper with **dual connections** (base + ER); router `getDelegationStatus` → `fqdn` — *devnet integration (Phase 7)*

### 5b. Supabase persistence
- [x] `@supabase/supabase-js` client wrapper (`backend/src/db/client.ts`), service-role, graceful `dbConfigured()`
- [x] Schema (`backend/src/db/schema.sql`): `agents`, `jobs`, `job_events`, enums, indexes, `updated_at` trigger — holds off-chain ciphertext (sealed boxes) + metadata
- [ ] Provision Supabase project + apply schema (needs your project keys)
- [ ] Realtime job-status push to frontend (Supabase Realtime / SSE)

### 5c. Stub enclave (clearly labeled) ✅
- [x] `backend/src/enclave/stub.ts` — decrypt prompt (x25519) → Claude inference (Anthropic SDK, `claude-opus-4-8`, offline fallback) → seal output to user
- [x] Computes input/output commitments; emits ed25519 quote binding `sha256(report_data ‖ mrtd)` in TDX layout; "STUB ENCLAVE" labeled

### 5d. REST API (for frontend) ✅ builds + boots
- [x] `GET/POST /agents`, `GET /agents/:id` (Supabase-backed, zod-validated)
- [x] `GET/POST /jobs`, `GET /jobs/:id`, `GET /jobs/enclave/pubkey`
- [x] `POST /jobs/:id/execute` — drives the stub enclave, mirrors verify/reject + sealed output to DB, writes `job_events`
- [x] `GET /jobs/:id/result`; central error handler (zod → 400); CORS
- [ ] Rate limiting (deferred)

### 5e. On-chain orchestrator (devnet — Phase 7)
- [ ] Job state machine driving real delegation → PER permission → escrow → verify_attestation → commit_and_settle
- [ ] Provider auth to Private ER (challenge → login → bearer token); dual-connection routing; `GetCommitmentSignature` + base confirm

> **Phase 5 status:** backend **builds green and boots** (`/health` ok). The demoable off-chain loop — create job → enclave decrypt/infer/attest → verify/reject → sealed result, all mirrored in Supabase — is complete. The on-chain submission wiring (5a client + 5e orchestrator) is deferred to devnet integration (Phase 7), which needs the funded wallet + live ER. Needs from you when ready: Supabase project keys + `ANTHROPIC_API_KEY`.

---

# Phase 6 — Frontend (Next.js + Tailwind + Framer + HugeIcons) 🔴

**Goal:** the polished lifecycle the judges see: Submit → Verifying → Verified → Paid — in a liquid-glass, Space Grotesk UI.

### 6a. Setup & design system ✅
- [x] Next.js 16 App Router + Tailwind v4 (read bundled Next 16 docs first)
- [x] **Space Grotesk** via `next/font` as the global font
- [x] **Color palette** as Tailwind v4 `@theme` tokens (`void…snow` + verify/reject/pending) in `globals.css`
- [x] Liquid-glass primitives (`components/ui/index.tsx`): `GlassCard`, `PillButton`, `PillInput`, `GlassTextArea`, `StatusChip`, `Badge` — Framer motion baked in; `glass`/`glass-raised` utilities
- [x] `AppNav` shell; global radial-glow bg + backdrop-blur; `cn` helper
- [x] API client (`lib/api.ts`); `lib/format.ts`; client user-key helper (`lib/userkey.ts`) for sealing output back

### 6b. Auth — Privy custom UI ✅
- [x] `@privy-io/react-auth` provider (`app/providers.tsx`), default modal disabled, dark theme, embedded Solana wallet
- [x] Custom login (`components/auth/CustomLogin.tsx`): email-code flow + **Google** + **X** (HugeIcons), all glass/pill
- [x] Sign-out in nav; landing gates on `authenticated`; graceful when Privy unconfigured

### 6c. Screens ✅ (build green, 7 routes)
- [x] **Landing** — pitch + tagline + custom login
- [x] **Create Private Job** — task, agent picker, budget; **client-side x25519 prompt encryption** to the enclave key before submit
- [x] **Agent catalog** — measurement (MRTD), price, verification rate, counts
- [x] **Dashboard** — jobs table with status chips
- [x] **Job detail** — redacted task, lifecycle checklist (Escrowed→Executed→Attested→Verified→Settled), **run-in-enclave → Verifying… → ✅ VERIFIED/❌ REJECTED** showing *both* checks, result commitment, and in-browser result decrypt

### 6d. Motion & polish
- [x] Framer transitions on cards, status changes, verification reveal; spinner during verify
- [x] Loading / empty / error states across screens
- [ ] Explorer-comparison component (naive memo vs commitment) for the demo reveal — *Phase 8*
- [ ] Supabase Realtime live status push — *Phase 7*

> **Phase 6 status:** frontend **builds green** (7 routes, TS clean). Runtime needs: backend running + Supabase provisioned, and the frontend's `NEXT_PUBLIC_*` vars in **`frontend/.env.local`** (Next only reads env from the frontend project dir, not the repo-root `.env`) — `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

# Phase 7 — Integration & E2E 🔴

**Goal:** one reproducible run, start to finish, on devnet.

- [x] **Program deployed to devnet** — `86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT` (deployer authority)
- [x] **Devnet E2E** (`anchor/scripts/devnet-e2e.ts`, `pnpm --filter @veilai/anchor devnet:e2e`): register → create → escrow → execute → **verify_attestation (real Ed25519 precompile + measurement)** → settle — **green on real devnet**
- [x] **INVALID path** E2E: tampered output → `Rejected` → escrow refunded — **green on real devnet** (the demo money-shot)
- [x] Uses a self-created SPL mint as stand-in USDC (no canonical-USDC funding needed)
- [x] **Live PER delegation** (`anchor/scripts/devnet-per.ts`) — **green on real MagicBlock devnet TEE**: create_job → `delegate_job` to the TEE validator (`MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`, ER `devnet-tee-as.magicblock.app`) → delegation propagated (base owner = delegation program, ER clone owned by veilai) → **`verifyTeeRpcIntegrity`** (genuine TDX quote) → challenge/login auth → **`init_permission` on the ER** (EphemeralPermission live, gated to [creator, provider])
- [ ] Backend orchestrator submits the on-chain txns (currently runs the off-chain enclave loop); wire frontend → backend → program — *carried into Phase 8*
- [ ] Reputation reflected in agent profile from real runs; latency budget ≤60s; backup recording — *Phase 8*

> **Phase 7 status: ✅ core complete on real devnet.** Both halves proven live: (1) the **proof-before-payment loop** (verified→paid, tampered→rejected→refunded via on-chain `verify_attestation` = Ed25519 precompile + MRTD allowlist), and (2) the **PER privacy layer** (delegation into the TEE-backed ER + TDX integrity check + EphemeralPermission). The prompt commitments live in private, permission-gated ER state, not public base state. Remaining: end-to-end backend orchestration wiring + demo polish (Phase 8).

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
