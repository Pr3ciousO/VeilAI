# VeilAI

**Private, verifiable execution infrastructure for AI agents.**

> Don't trust the agent. Verify it.

Users submit sensitive tasks to AI agents without exposing them as public onchain
state, and providers must **prove** their execution before they get paid. Job
state lives in a **MagicBlock Private Ephemeral Rollup (PER)**; inference runs in
a **separate provider TEE enclave** that emits a hardware attestation; the onchain
program verifies that attestation and only then settles payment on Solana.

See [`prd.md`](./prd.md) for the product spec and [`plan.md`](./plan.md) for the build plan.

## Two TEEs, two jobs

| TEE | Runs | Guarantees |
| --- | --- | --- |
| MagicBlock PER | private job **state** | prompt never becomes public Solana state |
| Provider enclave | the **inference** | "this exact model produced this output for this input" |

## Monorepo layout

```
anchor/     Rust + Anchor program (Phase 1+)
backend/    Express + TS: orchestrator, provider agent, stub enclave, REST API
frontend/   Next.js + Tailwind + Framer Motion + HugeIcons
shared/     TS: types, config, commitment + crypto (x25519/ed25519), attestation
```

## Prerequisites

- Node 24+, pnpm 12+
- Rust 1.89, Solana CLI 4.x, Anchor 1.0.2 (via avm)

## Setup

```bash
cp .env.example .env      # fill in secrets
pnpm install              # install all workspace deps
pnpm --filter @veilai/shared build
```

## Common commands

> Run workspace builds from the repo root (Next.js 16 auto-installs if invoked from
> its own subdir and loses workspace context).

```bash
pnpm --filter @veilai/shared build     # build shared lib
pnpm --filter @veilai/backend dev      # run backend (watch)
pnpm --filter @veilai/frontend dev     # run frontend
pnpm --filter @veilai/frontend build   # build frontend
pnpm anchor:build                      # build the Anchor program
pnpm anchor:test                       # anchor tests
```

## Status

Phase 0 (foundations) — in progress. Track work in [`plan.md`](./plan.md).
