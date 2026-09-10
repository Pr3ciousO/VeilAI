import express from "express";
import cors from "cors";
import { config } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "veilai-backend" });
});

// Route groups are mounted here as phases land:
//   app.use("/agents", agentsRouter);
//   app.use("/jobs", jobsRouter);

app.listen(config.port, () => {
  console.log(`[veilai] backend listening on :${config.port}`);
});
