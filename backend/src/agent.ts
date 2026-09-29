import "dotenv/config";
import express from "express";
import cors from "cors";
import { runChecks } from "./checks/index.js";

const PORT = Number(process.env.AGENT_PORT ?? 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`SulfNet agent listening on http://127.0.0.1:${PORT}`);
});