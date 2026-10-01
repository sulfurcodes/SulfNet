import type { CheckReport, DiagnoseResponse } from "./types";

const AGENT_URL: string = import.meta.env.VITE_AGENT_URL ?? "http://127.0.0.1:8787";
const CONTROL_URL: string = import.meta.env.VITE_CONTROL_URL ?? "http://localhost:8788";

type Source = "agent" | "control";

export class ApiError extends Error {
  source: Source;

  constructor(message: string, source: Source) {
    super(message);
    this.source = source;
  }
}

async function postJson<T>(
  base: string,
  path: string,
  body: unknown,
  source: Source,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `The ${source} returned an error (${res.status}).`;
      try {
        const data = await res.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // response wasn't JSON, keep the default message
      }
      throw new ApiError(message, source);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`The ${source} took too long to respond.`, source);
    }
    throw new ApiError(
      source === "agent"
        ? "Can't reach the local agent. Make sure it's running (npm run agent in the backend folder)."
        : "Can't reach the control server. Make sure it's running (npm run server in the backend folder).",
      source
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function runDiagnostic(url: string): Promise<DiagnoseResponse> {
  const local = await postJson<CheckReport>(
    AGENT_URL,
    "/check",
    { url },
    "agent",
    30_000
  );

  return postJson<DiagnoseResponse>(
    CONTROL_URL,
    "/diagnose",
    { url, local },
    "control",
    60_000
  );
}