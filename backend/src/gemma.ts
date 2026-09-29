import { GoogleGenAI } from "@google/genai";
import type { CheckReport } from "./checks/index.js";
import type { Verdict } from "./diagnose.js";

const TIMEOUT_MS = 15000;

type StageLike = {
  ok: boolean;
  ms?: number;
  skipped?: boolean;
  error?: { code?: string };
  status?: number;
};

function pick(r?: StageLike) {
  if (!r) return "n/a";
  if (r.skipped) return "skipped";
  return {
    ok: Boolean(r.ok),
    ms: typeof r.ms === "number" ? r.ms : undefined,
    error: r.error?.code ? String(r.error.code).slice(0, 40) : undefined,
    status: typeof r.status === "number" ? r.status : undefined,
  };
}

function compact(report: CheckReport) {
  return {
    dns: pick(report.dns),
    tcp: pick(report.tcp),
    tls: pick(report.tls),
    http: pick(report.http),
  };
}

export async function explainWithGemma(
  local: CheckReport,
  control: CheckReport,
  verdict: Verdict
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMMA_MODEL ?? "gemma-3-27b-it";
  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    "You are the explanation engine for SulfNet, a tool that tells people why a website can't be reached.",
    "A rule-based check already decided the verdict below. Explain it to a non-technical person.",
    "Rules: write 2 to 3 short sentences of plain English, then one line starting with 'Try:' giving 1 or 2 concrete next steps.",
    "Use only the data given. Do not invent causes that the data doesn't support. No markdown, no bullet points.",
    "",
    `Target: ${control.hostname ?? "unknown"}`,
    `Verdict: ${verdict.code} - ${verdict.title}`,
    `Rule-based summary: ${verdict.summary}`,
    `Local checks (user's network): ${JSON.stringify(compact(local))}`,
    `Control checks (external server): ${JSON.stringify(compact(control))}`,
  ].join("\n");

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TIMEOUT_MS);
  });

  const call = ai.models
    .generateContent({
      model,
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 350 },
    })
    .then((r) => r.text?.trim() || null)
    .catch((err: unknown) => {
      console.error("Gemma request failed:", err instanceof Error ? err.message : err);
      return null;
    });

  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}