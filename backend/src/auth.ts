import { PrivyClient } from "@privy-io/server-auth";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

/**
 * Privy access-token verification.
 *
 * Identity must come from a verified token, never from the request body — a
 * client-supplied `creator` field is just a claim, and every ownership check
 * below would be trivially bypassed by editing it.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Privy DID of the authenticated caller, set by `requireAuth`. */
      userId?: string;
    }
  }
}

let client: PrivyClient | null = null;

export function authConfigured(): boolean {
  return Boolean(config.privyAppId && config.privyAppSecret);
}

function privy(): PrivyClient {
  if (!client) {
    if (!authConfigured()) {
      throw new Error("PRIVY_APP_ID / PRIVY_APP_SECRET not set — cannot verify tokens");
    }
    client = new PrivyClient(config.privyAppId, config.privyAppSecret);
  }
  return client;
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/** Rejects the request unless it carries a valid Privy access token. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!authConfigured()) {
      // Failing closed matters: a misconfigured deploy must not silently serve
      // every user's data to anonymous callers.
      return res.status(503).json({ error: "Authentication is not configured on this server" });
    }
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const claims = await privy().verifyAuthToken(token);
    req.userId = claims.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Attaches `req.userId` when a valid token is present, but allows anonymous
 * callers through. For endpoints that are public yet behave differently when
 * the caller is known.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (token && authConfigured()) {
    try {
      const claims = await privy().verifyAuthToken(token);
      req.userId = claims.userId;
    } catch {
      /* anonymous */
    }
  }
  next();
}

/** 404 rather than 403 — an outsider shouldn't learn that a job id exists. */
export function assertOwner(
  res: Response,
  resourceCreator: string | null | undefined,
  userId: string | undefined,
): boolean {
  if (!userId || resourceCreator !== userId) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}
