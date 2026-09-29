import "dotenv/config";
import express from "express";
import cors from "cors";
import { runChecks, type CheckReport } from "./checks/index.js";
import { diagnose } from "./diagnose.js";
import { explainWithGemma } from "./gemma.js";

const PORT = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 8788);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

function isValidUrlInput(url: unknown): url is string {
  return typeof url === "string" && url.trim().length > 0 && url.length <= 2048;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, role: "control" });
});

app.post("/check", async (req, res) => {
  const url = req.body?.url;
  if (!isValidUrlInput(url)) {
    res.status(400).json({ error: 'Send JSON like { "url": "example.com" }' });
    return;
  }
  const report = await runChecks(url.trim());
  res.json({ vantage: "control", ...report });
});

app.post("/diagnose", async (req, res) => {
  const url = req.body?.url;
  const local = req.body?.local as CheckReport | undefined;

  if (!isValidUrlInput(url)) {
    res.status(400).json({ error: 'Send JSON like { "url": "example.com", "local": {...} }' });
    return;
  }
  if (!local || typeof local !== "object" || typeof local.input !== "string") {
    res.status(400).json({ error: 'Include the local agent report as "local".' });
    return;
  }

  const control = await runChecks(url.trim());
  const verdict = diagnose(local, control);
  const explanation = await explainWithGemma(local, control, verdict);

  res.json({
    url: url.trim(),
    local,
    control: { vantage: "control", ...control },
    verdict,
    explanation,
    explanationSource: explanation ? "gemma" : "fallback",
  });
});

app.listen(PORT, () => {
  console.log(`SulfNet control server listening on port ${PORT}`);
});