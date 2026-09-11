import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  commitAgentConfig,
  newAgentId,
  sealTo,
  edPublicFromSecret,
  hexToBytes,
  type AgentConfig,
} from "@veilai/shared";
import { config } from "../config.js";
import { enclavePublicKey } from "../enclave/key.js";
import { chainEnabled } from "../chain/client.js";
import { registerAgentOnChain } from "../chain/lifecycle.js";

export const agentsRouter = Router();

const CreateAgent = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  /** The agent's instructions — its IP. Sealed to the enclave, never stored plain. */
  systemPrompt: z.string().min(1).max(20_000),
  modelId: z.string().max(32),
  temperature: z.number().min(0).max(1).default(1),
  maxTokens: z.number().int().min(256).max(8192).default(4096),
  price: z.number().int().nonnegative(),
  capabilities: z.array(z.string()).default([]),
  /** Privy user id of the lister, for "my agents". */
  creator: z.string().optional(),
});

/** Public columns — never the sealed system prompt. */
const PUBLIC_COLUMNS =
  "id, authority, agent_id, name, description, model_id, config_commitment, " +
  "expected_measurement, quoting_key, price, capabilities, completed, verified, " +
  "rejected, reputation, avg_latency_ms, temperature, max_tokens, creator, " +
  "register_tx, created_at";

agentsRouter.get("/", async (req, res, next) => {
  try {
    let q = db().from("agents").select(PUBLIC_COLUMNS).order("created_at", { ascending: false });
    if (typeof req.query.creator === "string") q = q.eq("creator", req.query.creator);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ agents: data });
  } catch (e) {
    next(e);
  }
});

agentsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db()
      .from("agents")
      .select(PUBLIC_COLUMNS)
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    res.json({ agent: data });
  } catch (e) {
    next(e);
  }
});

/**
 * List a new agent.
 *
 * The system prompt is sealed to the enclave here and never stored in the
 * clear — so the operator cannot read a lister's IP, the same way they cannot
 * read a job's prompt. Its commitment is published on-chain, which is what lets
 * a buyer confirm the agent that ran is the agent they chose.
 *
 * Registration is custodial: the platform wallet is the on-chain authority,
 * because a Privy login has no funded devnet wallet. `creator` records who
 * listed it.
 */
agentsRouter.post("/", async (req, res, next) => {
  try {
    const body = CreateAgent.parse(req.body);

    if (!config.enclaveQuotingSecret || !config.enclaveMeasurement) {
      return res.status(503).json({ error: "Enclave not configured" });
    }
    if (!chainEnabled()) {
      return res
        .status(503)
        .json({ error: "Chain not configured — an agent cannot be listed without registration" });
    }

    const agentConfig: AgentConfig = {
      systemPrompt: body.systemPrompt,
      modelId: body.modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    };
    const configCommitment = commitAgentConfig(agentConfig);
    const agentId = newAgentId();
    const quotingKeyB58 = edPublicFromSecret(hexToBytes(config.enclaveQuotingSecret));

    // Register first: if the chain rejects it, no half-listed agent is left behind.
    const onChain = await registerAgentOnChain({
      agentId,
      modelId: body.modelId,
      configCommitment,
      measurement: config.enclaveMeasurement,
      quotingKeyB58,
      price: body.price,
    });

    const sealedPrompt = await sealTo(
      enclavePublicKey(),
      new TextEncoder().encode(body.systemPrompt),
    );

    const { data, error } = await db()
      .from("agents")
      .insert({
        id: onChain.agentPda,
        authority: onChain.authority,
        agent_id: agentId,
        name: body.name,
        description: body.description ?? null,
        model_id: body.modelId,
        config_commitment: configCommitment,
        system_prompt_ciphertext: sealedPrompt,
        temperature: body.temperature,
        max_tokens: body.maxTokens,
        expected_measurement: config.enclaveMeasurement,
        quoting_key: quotingKeyB58,
        price: body.price,
        capabilities: body.capabilities,
        creator: body.creator ?? null,
        register_tx: onChain.signature,
      })
      .select(PUBLIC_COLUMNS)
      .single();
    if (error) throw error;

    res.status(201).json({ agent: data });
  } catch (e) {
    next(e);
  }
});
