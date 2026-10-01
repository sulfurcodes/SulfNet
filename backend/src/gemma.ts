import { GoogleGenAI } from "@google/genai";
import type { CheckReport } from "./checks/index.js";
import type { Verdict } from "./diagnose.js";

const TIMEOUT_MS = 20000;

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
  // DEMO MODE: deterministic AI-style explanation fallback
  switch (verdict.code) {
    case "REACHABLE":
      return "The website is reachable from both your network and the control server. DNS, TCP, TLS and HTTP are all completing normally.";

    case "DOMAIN_NOT_FOUND":
      return "The domain cannot be resolved by either network, which indicates that the address may be incorrect, expired, or currently missing from DNS.";

    case "LOCAL_DNS_RESOLVER_FAIL":
      return "Your network is failing to resolve the domain while the external control server can. This points toward a problem with the DNS resolver being used by your network.";

    case "LOCAL_DNS_SINKHOLE":
      return "Your network is resolving the domain to a null or private address instead of the real destination. This pattern is consistent with DNS-level filtering or a local hosts-file rule.";

    case "CONTROL_ONLY_FAILURE":
      return "The website works from your network but fails from the external control server. This suggests the issue is specific to the control server's network or how the site handles external traffic.";

    case "HTTP_ERROR_EVERYWHERE":
      return "Both networks successfully reach the server, but the server returns an HTTP error. The failure therefore appears to be occurring at the website or application layer.";

    case "DIFFERENT_STAGES":
      return "The connection fails at different stages on the two networks. This suggests there may be an issue with the website while your own network may also be introducing a separate connectivity problem.";

    default: {
      const stage = verdict.localFailure?.stage ?? "network";
      return `SulfNet detected a difference during the ${stage} stage between your network and the external control server. The evidence points to a network-specific connectivity issue.`;
    }
  }
}