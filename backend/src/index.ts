import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { dbConfigured } from "./db/client.js";
import { authConfigured } from "./auth.js";
import { agentsRouter } from "./routes/agents.js";
import { jobsRouter } from "./routes/jobs.js";

const app = express();

// Locked to the deployed frontend in production; open only when CORS_ORIGINS
// is unset, which is the local-development case.
app.use(
    cors(
        config.corsOrigins.length
            ? { origin: config.corsOrigins, credentials: true }
            : undefined,
    ),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "veilai-backend",
        db: dbConfigured(),
        auth: authConfigured(),
    });
});

app.use("/agents", agentsRouter);
app.use("/jobs", jobsRouter);

// Central error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({ error: "validation_error", issues: err.issues });
    }
    const message = err instanceof Error ? err.message : "internal_error";
    console.error("[veilai] error:", message);
    res.status(500).json({ error: message });
});

app.listen(config.port, () => {
    console.log(`[veilai] backend listening on :${config.port} (db=${dbConfigured()})`);
});
