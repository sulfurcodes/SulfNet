import "dotenv/config";
import express from "express";
import cors from "cors";
import { runChecks } from "./checks/index.js";

const PORT = Number(process.env.AGENT_PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const CONTROL_URL = process.env.CONTROL_URL ?? "http://127.0.0.1:8788";
const GEMMA_URL = process.env.GEMMA_URL;

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, role: "agent" });
});

app.post("/check", async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== "string" || !url.trim() || url.length > 2048) {
    res.status(400).json({ error: 'Send JSON like { "url": "example.com" }' });
    return;
  }
  const report = await runChecks(url.trim());
  res.json({ vantage: "local", ...report });
});

app.post("/proof", async (req, res) => {
  try {
    res.json(await runProof(req.body.url, CONTROL_URL, askGemma));
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`SulfNet agent listening on http://127.0.0.1:${PORT}`);
});

async function askGemma(prompt: string): Promise<string | null> {
  if (!GEMMA_URL) return null;

  const response = await fetch(GEMMA_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.GEMMA_MODEL ?? "gemma", prompt, stream: false }),
  });
  if (!response.ok) throw new Error(`Gemma request failed (${response.status})`);

  const body = (await response.json()) as { response?: unknown };
  return typeof body.response === "string" ? body.response : null;
}

async function runProof(
  url: unknown,
  controlUrl: string,
  ask: (prompt: string) => Promise<string | null>,
): Promise<{ url: string; local: unknown; control: unknown; explanation: string | null }> {
  if (typeof url !== "string" || !url.trim() || url.length > 2048) {
    throw new Error("A valid URL is required");
  }

  const target = url.trim();
  const local = await runChecks(target);
  const response = await fetch(`${controlUrl.replace(/\/$/, "")}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: target }),
  });
  if (!response.ok) throw new Error(`Control check failed (${response.status})`);

  const control = await response.json();
  const explanation = await ask(
    `Compare these SulfNet checks for ${target} and briefly explain any differences:\n${JSON.stringify({ local, control })}`,
  );
  return { url: target, local, control, explanation };
}
