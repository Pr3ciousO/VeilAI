# VeilAI — project context

**VeilAI** = "Private, verifiable execution infrastructure for AI agents." MagicBlock
hackathon submission. Users submit sensitive tasks to AI agents without exposing them
as public on-chain state; providers must **prove** execution before they get paid.

- **Spec:** [`prd.md`](./prd.md) · **Build log / task tracker:** [`plan.md`](./plan.md)
- Read both at the start of a session — `plan.md` has the phase-by-phase status with tick boxes.

## Core design (don't blur these)
- **Two TEEs:** MagicBlock PER protects private job *state*; a separate provider enclave runs *inference* (decrypts the prompt — the operator can't read it).
- **Honest verification (the differentiator):** on-chain `verify_attestation` does BOTH an Ed25519 precompile signature check AND an **MRTD measurement allowlist** check. Measurement is bound into the signed message `sha256(report_data ‖ mrtd)`. Tampered output → `Rejected` → escrow refunded.
- **Escrow is a program-owned USDC vault** (release/refund gated by on-chain verification), not the hosted Payments API.
- **Enclave is a clearly-labeled STUB** for the MVP: real Claude inference + ed25519 quote in the real TDX field layout; swapping for real TDX changes zero on-chain code.

## Repo layout (pnpm workspace)
- `anchor/` — Rust + Anchor program (deployed to devnet: `86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT`), 11 instructions, 10/10 local tests. Devnet scripts: `scripts/devnet-e2e.ts`, `scripts/devnet-per.ts`.
- `backend/` — Express + TS: stub enclave, Supabase persistence, REST API. Env in `backend/.env`.
- `frontend/` — Next.js 16 + Tailwind v4 + Framer + HugeIcons + Privy custom login. Env in `frontend/.env.local`.
- `shared/` — TS types, commitment + x25519/ed25519 crypto, attestation codec.

## Status (as of last session)
Phases 0–7 complete; Phase 8 (demo polish) in progress. Proven on **real devnet**: full proof-before-payment loop (verified→paid, tampered→rejected→refunded) AND live PER delegation to the MagicBlock TEE (delegation + TDX integrity + EphemeralPermission). Backend live against Supabase with a seeded ResearchBot agent + real inference. Frontend builds. Remaining: hosting deploy (Vercel/Railway), frontend↔live-backend run-through, explorer-comparison reveal component, demo rehearsal.

## Toolchain gotchas (hard-won — see memory `veilai-toolchain`)
- Rust **1.98.1** (not 1.89); Solana **3.1.10**; Anchor **1.0.2** via avm (install avm from git unlocked). `OPENSSL_DIR`/`PKG_CONFIG_PATH` → brew openssl@3.
- Node via nvm; run workspace builds from repo root with `pnpm --filter`.
- Anchor 1.x: `CpiContext::new(program_id: Pubkey, …)`; `idl-build` needs `anchor-spl/idl-build`. Tests run via `anchor/scripts/test-local.sh` (Anchor 1.x's `anchor test` wants surfpool).
- TEE devnet: validator `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`, ER `devnet-tee-as.magicblock.app`; ER txns need `?token=` from `getAuthToken` (challenge→login).

## Commands
```bash
pnpm --filter @veilai/shared build
pnpm --filter @veilai/anchor test            # local program suite
pnpm --filter @veilai/anchor devnet:e2e      # full lifecycle on devnet
pnpm --filter @veilai/backend dev            # backend (reads backend/.env)
pnpm --filter @veilai/frontend dev           # frontend (reads frontend/.env.local)
```

## Conventions
- Keep `plan.md` tick-boxes updated as phases complete.
- Never overclaim privacy: the attested enclave sees the prompt by design; the operator and public do not.
- Secrets live in `backend/.env` + `frontend/.env.local` (both gitignored) — never commit them.
