import "dotenv/config";
import express from "express";
import cors from "cors";
import { runChecks } from "./checks/index.js";

const PORT = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 8788);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, role: "control" });
});

app.post("/check", async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== "string" || !url.trim() || url.length > 2048) {
    res.status(400).json({ error: 'Send JSON like { "url": "example.com" }' });
    return;
  }
  const report = await runChecks(url.trim());
  res.json({ vantage: "control", ...report });
});

app.listen(PORT, () => {
  console.log(`SulfNet control server listening on port ${PORT}`);
});