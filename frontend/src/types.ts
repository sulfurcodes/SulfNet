export type Stage = "dns" | "tcp" | "tls" | "http";
export type Severity = "ok" | "warn" | "fail";
export type Phase = "idle" | "loading" | "done" | "error";

export interface StageResult {
  ok: boolean;
  ms?: number;
  skipped?: boolean;
  error?: { code?: string; message: string };
  addresses?: string[];
  protocol?: string | null;
  validTo?: string;
  issuer?: string;
  status?: number;
  location?: string;
}

export interface CheckReport {
  vantage?: "local" | "control";
  input: string;
  invalid?: boolean;
  url?: string;
  hostname?: string;
  port?: number;
  dns?: StageResult;
  tcp?: StageResult;
  tls?: StageResult;
  http?: StageResult;
}

export interface Verdict {
  code: string;
  severity: Severity;
  title: string;
  summary: string;
  notes: string[];
}

export interface DiagnoseResponse {
  url: string;
  local: CheckReport;
  control: CheckReport;
  verdict: Verdict;
  explanation: string | null;
  explanationSource: "gemma" | "fallback";
}