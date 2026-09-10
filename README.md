# VeilAI

**Private, verifiable execution infrastructure for AI agents.**

> Don't trust the agent. Verify it.

Users submit sensitive tasks to AI agents without exposing them as public on-chain
state, and providers must **prove** their execution before they get paid. Job state
lives in a **MagicBlock Private Ephemeral Rollup (PER)**; inference runs in a
**separate provider TEE enclave** that emits a hardware attestation; the on-chain
program verifies that attestation and only then settles payment on Solana.

- Product spec: [`prd.md`](./prd.md) · Build log: [`plan.md`](./plan.md)
- Devnet program: **`86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT`**

---

## The idea in one picture

```
USER ──seal prompt (x25519)──▶ MagicBlock PER (TEE)  ──▶ Provider enclave (TEE)
                                private, permissioned      decrypt → run model
                                                                │
                                                       TDX attestation (quote)
                                                                │
                                                    on-chain verify_attestation
                                        Ed25519 precompile ✓  +  MRTD allowlist ✓
                                          │                              │
                                     VALID → pay provider        INVALID → refund
                                                     ▼
                                                  SOLANA
```

### Two TEEs, two jobs

| TEE | Runs | Guarantees |
| --- | --- | --- |
| **MagicBlock PER** | private job **state** | the prompt never becomes public Solana state |
| **Provider enclave** | the **inference** | "this exact model produced this output for this input" |

The prompt is decrypted **only** inside the provider enclave — the operator can't
read it. That's genuine privacy, not "hidden from the chain but visible to the provider."

---

## Why the verification is honest

The differentiator is that **"VERIFIED" means something.** The on-chain
`verify_attestation` does **both**:

1. **Quote signature** — an Ed25519 precompile proves the quote was signed by the
   agent's allowlisted quoting key (stands in for the TEE hardware key), and the
   program confirms via instruction-sysvar introspection that it verified the
   *exact* `sha256(report_data ‖ mrtd)` triple.
2. **Measurement allowlist** — `mrtd == agent.expected_measurement`. This is the
   step MagicBlock's `verifyTeeRpcIntegrity` deliberately *doesn't* do — and it's
   exactly what proves the *right model* ran.

The measurement is **cryptographically bound** to the signature (the enclave signs
`sha256(report_data ‖ mrtd)`), so a valid enclave key can't claim a false
measurement, and a tampered output changes `report_data` and fails the check →
`Rejected` → escrow refunded.

---

## What's real vs. stubbed (the honesty slide)

| Piece | Status |
| --- | --- |
| On-chain program (11 instructions), all state + guards | **Real**, deployed to devnet |
| `verify_attestation` — Ed25519 precompile + MRTD allowlist + report-data binding | **Real** |
| Escrow, settlement, refund, reputation | **Real** (program-owned USDC vault) |
| MagicBlock PER: delegation to TEE validator + `EphemeralPermission` + TDX integrity check | **Real**, exercised on devnet |
| Provider enclave | **Stubbed** — runs real Claude inference and emits an ed25519 quote in the **real TDX field layout**; on-chain verifier runs the genuine two-step check against it |

> Swapping the stub enclave for a real TDX enclave changes **zero on-chain code** —
> only the signer and DCAP quote-parsing move into hardware. The verifier is production.

---

## Proven on real devnet

Both halves run green against live infrastructure:

```bash
# Full proof-before-payment loop (verified→paid AND tampered→rejected→refunded)
pnpm --filter @veilai/anchor devnet:e2e

# Live PER privacy layer: delegate to the TEE validator, verify TDX integrity,
# authenticate, and create the EphemeralPermission on the real MagicBlock TEE ER
pnpm --filter @veilai/anchor exec tsx scripts/devnet-per.ts
```

- Local program suite: **10/10 passing** (`pnpm --filter @veilai/anchor test`)
- TEE ER: `devnet-tee-as.magicblock.app` · TEE validator `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`

---

## Architecture

```
anchor/     Rust + Anchor program (Job/Agent state, PER delegation + permissions,
            verify_attestation via Ed25519 precompile, escrow + settlement)
backend/    Express + TS: stub enclave (x25519 decrypt → Claude → ed25519 quote),
            Supabase persistence, REST API, orchestrator
frontend/   Next.js 16 + Tailwind v4 + Framer Motion + HugeIcons + Privy custom login;
            liquid-glass design system, Space Grotesk
shared/     TS: types, commitment + x25519/ed25519 crypto, TDX-shaped attestation codec
```

## Stack

Rust · Anchor 1.0.2 · `ephemeral-rollups-sdk` 0.16.2 · Solana devnet · MagicBlock PER
· Node/Express/TypeScript · Supabase · Next.js · Tailwind · Framer Motion · HugeIcons
· Privy (custom email + Google + X login) · Anthropic Claude (enclave inference)

## Prerequisites

Node 24+ · pnpm 12+ · Rust 1.98 · Solana CLI 3.1.10 · Anchor 1.0.2 (via avm)

## Run locally

```bash
pnpm install
pnpm --filter @veilai/shared build

# Backend (needs backend/.env: Supabase + Anthropic key)
pnpm --filter @veilai/backend migrate   # apply Supabase schema (once)
pnpm --filter @veilai/backend seed       # seed the ResearchBot agent
pnpm --filter @veilai/backend dev

# Frontend (needs frontend/.env.local: Privy app id, backend url, Supabase anon)
pnpm --filter @veilai/frontend dev

# Program
pnpm --filter @veilai/anchor test        # local suite (solana-test-validator)
```

## The demo

Submit → **Verifying…** → ✅ **VERIFIED** → **Paid**, then the money-shot: submit a
tampered result and watch it get **Rejected** and the escrow **refunded** — the
whole point of *proof before payment*.
