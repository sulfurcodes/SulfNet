export type Stage = "dns" | "tcp" | "tls" | "http";
export type Severity = "ok" | "warn" | "fail";
export type Phase = "idle" | "loading" | "done" | "error";

export interface ResolverAnswer {
  name: string;
  server: string;
  ok: boolean;
  ms: number;
  addresses?: string[];
  error?: { code?: string; message: string };
}

export interface RedirectHop {
  url: string;
  status: number;
  ms: number;
}

export interface StageResult {
  ok: boolean;
  ms?: number;
  skipped?: boolean;
  error?: { code?: string; message: string };
  addresses?: string[];
  resolvers?: ResolverAnswer[];
  protocol?: string | null;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysLeft?: number;
  status?: number;
  finalUrl?: string;
  hops?: RedirectHop[];
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
  tips: string[];
}

export interface DiagnoseResponse {
  url: string;
  local: CheckReport;
  control: CheckReport;
  verdict: Verdict;
  explanation: string | null;
  explanationSource: "gemma" | "fallback";
}