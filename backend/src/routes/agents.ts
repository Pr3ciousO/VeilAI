import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";

export const agentsRouter = Router();

const RegisterAgent = z.object({
  id: z.string(), // agent PDA (base58)
  authority: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  modelId: z.string(),
  expectedMeasurement: z.string(), // hex MRTD
  quotingKey: z.string(), // base58 ed25519
  price: z.number().int().nonnegative(),
  capabilities: z.array(z.string()).default([]),
});

agentsRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await db().from("agents").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ agents: data });
  } catch (e) {
    next(e);
  }
});

agentsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db().from("agents").select("*").eq("id", req.params.id).single();
    if (error) throw error;
    res.json({ agent: data });
  } catch (e) {
    next(e);
  }
});

agentsRouter.post("/", async (req, res, next) => {
  try {
    const body = RegisterAgent.parse(req.body);
    const { data, error } = await db()
      .from("agents")
      .upsert({
        id: body.id,
        authority: body.authority,
        name: body.name,
        description: body.description ?? null,
        model_id: body.modelId,
        expected_measurement: body.expectedMeasurement,
        quoting_key: body.quotingKey,
        price: body.price,
        capabilities: body.capabilities,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ agent: data });
  } catch (e) {
    next(e);
  }
});
