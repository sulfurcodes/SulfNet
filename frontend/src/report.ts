import type {
  CheckReport,
  DiagnoseResponse,
  RedirectHop,
  ResolverAnswer,
  Stage,
  StageResult,
} from "./types";

const STAGES: Stage[] = ["dns", "tcp", "tls", "http"];

function stageLine(r?: StageResult): string {
  if (!r) return "-";
  if (r.skipped) return "skipped";
  const parts: string[] = [r.ok ? "PASS" : "FAIL"];
  if (typeof r.ms === "number") parts.push(`${r.ms} ms`);
  if (r.error?.code) parts.push(r.error.code);
  else if (r.status) parts.push(`HTTP ${r.status}`);
  return parts.join(" / ");
}

function resolverLine(a?: ResolverAnswer): string {
  if (!a) return "-";
  if (a.ok) return `answered (${[...(a.addresses ?? [])].sort()[0] ?? "no address"})`;
  return `failed (${a.error?.code ?? "error"})`;
}

function chainLines(report: CheckReport): string[] {
  const hops: RedirectHop[] = report.http?.hops ?? [];
  return hops.length > 1 ? hops.map((h) => `  ${h.status} ${h.url}`) : [];
}

export function buildReportText(result: DiagnoseResponse): string {
  const { verdict, local, control, explanation } = result;
  const out: string[] = [];

  out.push(`SulfNet report for ${control.hostname ?? result.url}`);
  out.push(new Date().toLocaleString());
  out.push("");
  out.push(`VERDICT: ${verdict.title}`);
  out.push(verdict.summary);
  for (const note of verdict.notes) out.push(`Note: ${note}`);

  if (explanation) {
    out.push("");
    out.push(explanation);
  }

  out.push("");
  out.push("CHECKS (your network | control server)");
  for (const s of STAGES) {
    out.push(`${s.toUpperCase().padEnd(5)} ${stageLine(local[s])}  |  ${stageLine(control[s])}`);
  }

  const resolvers = local.dns?.resolvers ?? [];
  if (resolvers.length > 0) {
    out.push("");
    out.push("DNS RESOLVERS (your network | control server)");
    for (const r of resolvers) {
      const other = control.dns?.resolvers?.find((c) => c.server === r.server);
      out.push(`${r.name} (${r.server}): ${resolverLine(r)}  |  ${resolverLine(other)}`);
    }
  }

  const chain = chainLines(local).length ? chainLines(local) : chainLines(control);
  if (chain.length > 0) {
    out.push("");
    out.push("REDIRECT CHAIN");
    out.push(...chain);
  }

  if (verdict.tips.length > 0) {
    out.push("");
    out.push("WHAT TO TRY");
    verdict.tips.forEach((tip, i) => out.push(`${i + 1}. ${tip}`));
  }

  return out.join("\n");
}