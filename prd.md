# VeilAI

### Name

**VeilAI**
*Private, verifiable execution infrastructure for AI agents.*

> **AI agents can do the work. VeilAI makes their execution private, verifiable, and economically accountable.**

Demo tagline:

> ### **Don't trust the agent. Verify it.**

---

# 1. Product Summary

VeilAI is **private, verifiable execution infrastructure for AI agents** on Solana. Users submit sensitive tasks to AI agents without exposing the task as public onchain state, and providers must **prove** their execution before they get paid.

Sensitive job state is held inside a **MagicBlock Private Ephemeral Rollup (PER)** — a TEE-backed rollup where the account is gated by an `EphemeralPermission`. Inference runs inside a **separate provider TEE enclave** that emits a hardware attestation. The onchain program verifies that attestation and, only if valid, settles payment on Solana.

### The core idea

```text
USER
  │  confidential task (encrypted to provider enclave)
  ▼
MAGICBLOCK PRIVATE ER (TEE)
  │  private job state, permissioned
  ▼
PROVIDER ENCLAVE (TEE)
  │  decrypts prompt, runs model
  ▼
HARDWARE ATTESTATION (TDX quote)
  │
  ▼
ONCHAIN VERIFICATION
  │  quote valid AND workload measurement in allowlist?
  ├── VALID → payment released + reputation ↑
  └── INVALID → escrow refunded, nothing paid
  │
  ▼
SOLANA (Magic Action settlement)
```

### Two TEEs, two jobs

This distinction is the heart of the product. Do not blur it.

| TEE | Runs | Guarantees |
| --- | --- | --- |
| **MagicBlock PER** (TDX) | private job **state** | the prompt is never exposed as public Solana state |
| **Provider enclave** (TDX / confidential GPU) | the **inference** | "this exact model produced this output for this input" |

The prompt is decrypted **only** inside the provider enclave. The operator running the machine cannot read it. That is genuine privacy — not "hidden from the chain but fully visible to the provider."

**MVP constraint:** we do **not** run an LLM inside MagicBlock PER. MagicBlock provides private state, permissioning, and settlement coordination — not GPU inference. Inference happens in the provider's own enclave.

---

# 2. Problem

AI agents can increasingly perform work autonomously. Users face three problems.

### Problem 1 — Privacy

Users want to hand agents confidential documents, proprietary business data, financial records, private research, unpublished code, and sensitive prompts. Putting any of that directly on a public blockchain is unacceptable.

### Problem 2 — Trust

A provider can claim *"I ran the requested model and produced this result."* The user has no way to know whether the claimed model actually ran, or ran honestly.

### Problem 3 — Economic accountability

If an agent performs bad or fraudulent work, can it lose reputation, have payment withheld, or be penalized?

Existing AI-agent marketplaces focus on **discovery and payment**. VeilAI focuses on:

> **private + verifiable + accountable execution.**

---

# 3. Target Users

## Primary — AI-agent developers/providers

Want to monetize agents, receive jobs, build reputation, prove successful execution, and compete on price/quality.

## Secondary — Users/businesses

Want to submit confidential tasks, choose agents, keep data off public chain, verify execution, and pay automatically.

## Future — AI-agent marketplaces

VeilAI can be the privacy/verification layer that existing marketplaces integrate. You are not trying to beat every marketplace — you are building the:

> **trust layer underneath them.**

---

# 4. Product Goals (MVP)

1. Demonstrate a confidential AI job end to end.
2. Store sensitive job state inside MagicBlock PER, gated by `EphemeralPermission`.
3. Escrow payment **before** execution.
4. Have a provider execute the job in an enclave and emit a hardware attestation.
5. **Verify the attestation onchain** — quote validity **and** workload-measurement allowlist.
6. Settle payment on Solana via a Magic Action, only on valid verification.
7. Maintain provider reputation from verified outcomes.
8. Demonstrate the complete lifecycle in a polished UI.

---

# 5. Non-Goals (do NOT attempt for the hackathon)

- ❌ Build an LLM.
- ❌ Build a decentralized GPU network.
- ❌ Build a ZK inference (zkML) system — correct property, wrong hackathon.
- ❌ Train AI models.
- ❌ Build 100 agents, or a full marketplace like Hive.
- ❌ Claim the provider "cannot see the prompt" **unless the enclave architecture actually provides it**. In the MVP, be precise about which TEE guarantees which property.

---

# 6. Core User Flow

## Step 1 — Connect wallet

User connects Phantom/Solflare on devnet.

## Step 2 — Create private job

User enters:

- **Task:** *"Analyze this financial report and identify the three largest cost increases."*
- **Agent type:** Financial Analyst
- **Budget:** 0.05 USDC
- **Verification:** Hardware attestation (TEE)

The prompt is **encrypted to the target provider enclave's public key** in the browser before it ever leaves the client. Then: **Create Private Job**.

## Step 3 — Job enters PER

The program creates the job state on base, then delegates it into the PER.

```text
JobAccount
  job_id
  creator
  agent
  prompt_ciphertext_commitment   // hash of the encrypted prompt
  status                         // Created | Escrowed | Executing | Verified | Rejected | Settled
  budget
  created_at
  input_commitment
  output_commitment
  attestation_status
  expected_measurement           // allowlisted MRTD/RTMR for the chosen agent
```

Privacy is applied through MagicBlock's PER flow: **delegate only the data account on the base layer**, then on the ER create an `EphemeralPermission` with `CreateEphemeralPermissionCpi`, restricting access to `[user, provider]`.

## Step 4 — Escrow

User escrows the budget **before** execution using the Private Payments API (`POST /v1/spl/deposit`, `private: true`). This is what makes "proof before payment" real — there must be funds held that verification can release or refund.

## Step 5 — Agent receives job

For the hackathon, use **one real provider/agent** (e.g. `ResearchBot`: document analysis, summarization, extraction). The provider authenticates to the Private ER through the challenge → login → bearer-token flow, then reads the private job state.

## Step 6 — Agent executes in an enclave

Inside the provider TEE enclave:

```text
decrypt prompt  →  run model  →  output
```

The enclave computes `input_commitment` and `output_commitment`, encrypts the output to the user's key, and produces a **TDX quote** whose report-data binds the execution.

## Step 7 — Attestation

The provider submits, on the ER:

```text
attestation = TDX_quote {
  report_data = hash( input_commitment ‖ output_commitment ‖ model_id ‖ nonce )
  MRTD / RTMR = measurement of the enclave image (model + runtime)
}
+ output_ciphertext (encrypted to the user)
```

The signature is produced by the TEE **hardware**, not the provider's wallet. The provider cannot alter the result after the fact without invalidating the quote.

## Step 8 — Onchain verification

The program's `verify_attestation` performs **both** checks:

1. **Quote validity** — the TDX quote is genuine and bound to this job's `nonce`. (Same primitive as `verifyTeeRpcIntegrity`.)
2. **Workload allowlist** — `MRTD/RTMR == expected_measurement` for the chosen agent.

> Step 2 is the one MagicBlock's `verifyTeeRpcIntegrity` helper deliberately does **not** do — it proves a genuine quote but does not compare the measurement to an expected workload. Doing the allowlist check ourselves is exactly what proves *the right model ran*, and is the reason "VERIFIED" means something.

UI: 🟡 Verifying… → ✅ VERIFIED (or ❌ Rejected).

## Step 9 — Settlement

State is committed back with `commit_and_undelegate`, carrying a post-commit **Magic Action** that settles payment:

```text
Private job verified
      ↓
commit_and_undelegate + add_post_commit_actions([settle_payment])
      ↓
escrow released to provider   +   reputation ↑
```

If verification fails, escrow is refunded and nothing is paid.

**Two correctness requirements for the settle action:**

- The `settle_payment` `#[action]` handler **must authenticate via the injected `escrow` signer** (pinned to `ephemeral_balance_pda_from_payer(escrow_auth, 255)`), not merely `address = crate::ID`. Otherwise the handler is directly callable by any wallet and escrow can be drained.
- Give settlement a **durable idempotency key**. A commit retry can drop a scheduled action, so surface "settling" and "settled" as distinct states and observe the base-layer effect before marking paid.

---

# 7. Agent Profile

Each agent has a public profile.

# ResearchBot
**Research & document analysis** · ⭐ verification rate

| Metric         | Value |
| -------------- | ----: |
| Jobs completed | live  |
| Verified       | live  |
| Rejected       | live  |
| Avg. latency   | live  |
| Avg. cost      | live  |
| Reputation     | live  |

**Enclave measurement (allowlisted):** `MRTD 0x…`
**Verification:** hardware attestation enabled

> Reputation and counts must be derived from **actual** demo runs, or clearly labeled as sample data. Do not present seeded numbers as real — judges notice, and it undermines the verification story.

---

# 8. Job Dashboard

### My Jobs

| Job                | Agent       | Status        |  Cost |
| ------------------ | ----------- | ------------- | ----: |
| Financial analysis | ResearchBot | ✅ Verified    | $0.03 |
| Document summary   | LegalAgent  | 🟡 Verifying  | $0.02 |
| Data extraction    | DataBot     | ✅ Settled     | $0.04 |

Clicking a job:

```text
JOB #4821

Private Task
████████████████

Agent            ResearchBot
Model / measurement  X · MRTD 0x7a…

Status
✓ Escrowed
✓ Executed (in enclave)
✓ Attested (TDX quote)
✓ Verified (quote + measurement)
✓ Settled

Payment          0.03 USDC
Verification     VALID
Solana settlement  View transaction →
```

---

# 9. Privacy Model

Be **extremely clear** about who can see what.

### Public (onchain)

job ID · provider identity · payment · status · commitments/hashes · enclave measurement · reputation

### Private

actual prompt · confidential job state · sensitive inputs · plaintext output

### Who can see the prompt

| Party | Sees the prompt? |
| --- | --- |
| The public / Solana explorer | No — only a commitment |
| Non-authorized ER members | No — gated by `EphemeralPermission` |
| Provider **operator** (the machine's owner) | No — decrypted only inside the enclave |
| Provider **enclave** (the attested workload) | Yes — it must, to run inference |

### Wording

Do **not** say: *"Nobody can ever see your prompt."*

Say: **"Your job runs privately inside MagicBlock's PER and is decrypted only inside an attested provider enclave — never as public Solana state, and never by the provider's operator."**

Defensible, and true.

---

# 10. MagicBlock Integration

Judges should see MagicBlock is load-bearing, not decorative.

### 1. Private Ephemeral Rollup (PER)
Core privacy layer. Delegate **only the data account** on base; job state lives in the TEE-backed ER.

### 2. EphemeralPermission
On the ER, `CreateEphemeralPermissionCpi` / `UpdateEphemeralPermissionCpi` / `CloseEphemeralPermissionCpi` gate the job to `[user, provider]`. Retain a trusted permission authority so the app can't lock itself out. Treat publishing a permissioned account as a confidentiality change.

### 3. TEE authorization
Client authenticates via challenge → login → bearer token before reading private state; uses the ER `fqdn` from router `getDelegationStatus`. `verifyTeeRpcIntegrity` confirms a genuine quote — we add the workload-allowlist check on top.

### 4. Commit / undelegate
`commit_and_undelegate` returns state to Solana at end of lifecycle (use `MagicIntentBundleBuilder`, not the deprecated free functions).

### 5. Magic Actions
Post-commit settlement runs automatically after the ER commit lands on base:

```text
private job verified → PER commit → Magic Action → settle payment + update reputation
```

Authenticate the handler via the injected `escrow` signer; make it idempotent; observe the base effect before reporting "settled."

### 6. Private Payments API
Escrow deposit, private transfer of the payout, and balance reads (`/v1/spl/deposit`, `/v1/spl/transfer`, `/v1/spl/private-balance`). Source confirmation ≠ final settlement for queued transfers — reconcile.

---

# 11. Architecture

```text
                    USER
                     │  encrypt prompt to enclave key
                     ▼
              ┌──────────────┐
              │   FRONTEND   │
              │   Next.js    │
              └──────┬───────┘
                     ▼
              ┌──────────────┐
              │ Solana/Anchor│
              │   Program    │
              └──────┬───────┘
                delegation (data account only)
                     ▼
          ┌─────────────────────┐
          │ MAGICBLOCK PRIVATE  │
          │ EPHEMERAL ROLLUP    │  (TDX)
          │  Private job state  │
          │  EphemeralPermission│
          └──────────┬──────────┘
                     ▼
              ┌──────────────┐
              │ PROVIDER     │  (TDX / confidential GPU)
              │ ENCLAVE      │
              │ decrypt→model│
              └──────┬───────┘
                     ▼
              ┌──────────────┐
              │ TDX QUOTE /  │
              │ ATTESTATION  │
              └──────┬───────┘
                     ▼
          ┌─────────────────────┐
          │ ONCHAIN VERIFIER    │
          │ quote + measurement │
          └──────────┬──────────┘
              commit_and_undelegate + Magic Action
                     ▼
          ┌─────────────────────┐
          │       SOLANA        │
          │  Payment · Rep ·    │
          │  Commitments        │
          └─────────────────────┘
```

---

# 12. MVP Feature Scope

## P0 — MUST HAVE

**Wallet:** connect wallet · devnet.

**Private job:** create job · client-side prompt encryption to enclave key · job status.

**MagicBlock:** delegation · PER · `EphemeralPermission` · challenge/login auth · confidential transaction.

**Escrow:** deposit budget **before** execution (Private Payments API). *(Promoted from P1 — "proof before payment" is meaningless without funds to hold.)*

**AI provider:** one provider · one model · one agent type, running in an enclave (real or clearly-labeled stub, see §21).

**Verification:** commitments · attestation submission · **onchain `verify_attestation` doing quote validity + measurement allowlist** · verification status.

**Settlement:** Magic Action releases escrow on valid verification / refunds on invalid · transaction record · authenticated + idempotent settle handler.

**UI:** job creation · dashboard · agent profile · verification screen.

---

# 13. P1 — SHOULD HAVE

- **Multiple agents** (ResearchBot, CodeBot, DataBot) each with their own allowlisted measurement.
- **Agent discovery** — filter by price, category, reputation, latency.
- **Provider reputation** derived from verified outcomes.
- **INVALID-path demo** — submit a tampered result and show rejection + refund live (see §19).
- **Real enclave** — replace the stub attestation with a genuine TDX enclave (no onchain code change).

---

# 14. P2 — FUTURE

Provider staking · slashing (invalid execution → slash stake) · agent auctions · multi-provider redundant verification · dispute system · agent-to-agent tasks · enterprise API. Do not let these distract during the hackathon.

---

# 15. Business Model

Take a **1–3%** protocol fee per completed job.

Example: $0.10 inference → $0.098 provider, $0.002 protocol. At 1M jobs × $0.10 = $100k GMV, a 2% fee is ~$2k — but the real value is **infrastructure volume**, not the MVP fee.

---

# 16. Why MagicBlock Benefits

VeilAI drives recurring usage of PER → confidential transactions → state delegation → commitments → settlement. AI agents are inherently high-frequency:

```text
1 user → 10 jobs → 100 private state transitions
10,000 users → 100,000 jobs → millions of execution events
```

A far more attractive workload for MagicBlock than a static app.

---

# 17. Competitive Positioning

| | Focus |
| --- | --- |
| Existing AI-agent marketplace | discovery + execution + payment |
| **VeilAI** | **privacy + verification + accountability** |

Positioning:

> **"The trust layer for AI-agent marketplaces."**

---

# 18. Key Differentiator

# **Proof before payment**

Not *"here's an AI agent"* — but **"here's an AI agent whose execution is hardware-attested and verified onchain before it gets paid."**

---

# 19. Hackathon Demo

- **0:00 — Problem.** *"I want an agent to analyze a confidential document."* Create job; prompt is encrypted client-side.
- **0:30 — Private job created.** Show the prompt going into private state; show the Solana explorer displaying only a commitment.
- **1:00 — Pick agent.** `ResearchBot · $0.03 · verified · 2.1s · MRTD 0x7a…`. Escrow funds.
- **1:30 — Executes in enclave.** Dashboard: *Verifying…*
- **2:00 — Attestation submitted** (TDX quote).
- **2:15 — ✅ VERIFIED.** Show *both* checks passed: quote valid **and** measurement allowlisted.
- **2:30 — Payment settles** via Magic Action: `0.03 USDC → ResearchBot`.
- **2:40 — INVALID path** *(the moment that wins it)*: submit a tampered result; show `verify_attestation` **reject** it and **refund** escrow. This proves accountability, not just a happy path.
- **2:55 — The reveal:** side-by-side — naive onchain version shows the prompt as a readable memo in the explorer; VeilAI shows only a commitment. *"The prompt was never public Solana state, and only the attested enclave ever decrypted it."*

---

# 20. Success Metrics

### Technical
- 1 private AI job completed end to end
- 1 PER execution with `EphemeralPermission`
- 1 onchain verification (quote + measurement) that **also rejects** a tampered result
- 1 escrow settlement via Magic Action (and 1 refund on the invalid path)
- 100% reproducible demo (pre-warmed happy path recorded as backup)

### Product
- ≤ 60s from job creation → verified result
- agent profile · verification status · payment receipt

### Long-term
jobs · verification rate · provider retention · inference volume · GMV · MagicBlock execution volume

---

# 21. Biggest Technical Risks

### 🔴 Risk 1 — Real enclave inference is hard in hackathon time
Full TDX / confidential-GPU inference in ~72h is a stretch.

**Mitigation:** ship the **verifier for real** and **stub the enclave**, clearly labeled. The stub runs the model and emits a **self-signed attestation in the real TDX quote format**; `verify_attestation` runs the genuine two-step check (quote + measurement) against it. Demo line: *"The verifier is production; the enclave is stubbed. Swapping the stub for a real TDX enclave changes zero onchain code."* This is far stronger than a fake "verified" checkmark.

### 🔴 Risk 2 — Privacy boundaries
PER gives private state + permissioning; it does **not** make an external provider blind to data you send it. That blindness comes from the **provider enclave**, and only for the operator — the attested workload must see the prompt to run it. State this precisely (see §9); never overclaim.

### 🟠 Risk 3 — Too much blockchain in the UX
Users should not need to understand PDAs, delegation, TEE authorization, commitments, or attestations. They see: **Submit → Verifying → Verified → Paid.**

### 🟠 Risk 4 — Settlement is asynchronous
A Magic Action can be scheduled but dropped on retry. Never report "paid" from the ER signature alone. Authenticate the settle handler via the escrow signer, make it idempotent, and observe the base-layer effect. Model "settling" vs "settled" explicitly.

---

# 22. The MVP to Actually Build

```text
User
 → Create private AI job (prompt encrypted to enclave)
 → MagicBlock PER holds private, permissioned job state
 → Escrow budget
 → One AI agent executes in an enclave → TDX attestation
 → Onchain verify: quote valid AND measurement allowlisted
 → Magic Action settles payment (or refunds on invalid)
 → User: verified result
```

That's it. Don't build the whole decentralized AI economy.

---

# 23. One-Sentence Pitch

> **VeilAI is private, verifiable execution infrastructure for AI agents: sensitive jobs run through MagicBlock Private Ephemeral Rollups, inference is hardware-attested in a provider enclave, and providers must prove execution onchain before they get paid.**

Demo tagline:

> ### **Don't trust the agent. Verify it.**

---

# 24. Product Hierarchy

```text
                 VEILAI
                   │
       ┌───────────┴───────────┐
   PRIVATE                  VERIFIED
       │                       │
 MagicBlock PER +       TDX attestation +
 provider enclave       onchain measurement check
       │                       │
       └───────────┬───────────┘
              ACCOUNTABLE
                   │
         Escrow → Magic Action → Solana payments
```

- **Privacy is the MagicBlock hook** (PER + enclave).
- **Verification is the innovation** (quote + measurement allowlist onchain).
- **Payment/reputation is the business model** (escrow + Magic Action).
- **AI agents are the market.**

### Build-against-current note
Use the current `ephemeral-rollups-sdk` (v0.16.x snapshot in the skill), `MagicIntentBundleBuilder` for commit/undelegate/actions (not the deprecated free functions), and re-fetch the Private Payments `/doc` OpenAPI before integrating. Inspect the target repo's manifests/toolchain before changing any dependency.

[1]: https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart "Quickstart - MagicBlock Documentation"
