import type { BaseResult, CheckReport } from "./checks/index.js";

export type Stage = "dns" | "tcp" | "tls" | "http";
export type Severity = "ok" | "warn" | "fail";

export interface StageFailure {
  stage: Stage;
  code?: string;
  message?: string;
  status?: number;
}

export interface Verdict {
  code: string;
  severity: Severity;
  title: string;
  summary: string;
  localFailure?: StageFailure;
  controlFailure?: StageFailure;
  notes: string[];
}

const STAGES: Stage[] = ["dns", "tcp", "tls", "http"];

const LABEL: Record<Stage, string> = {
  dns: "DNS lookup",
  tcp: "TCP connection",
  tls: "TLS handshake",
  http: "HTTP request",
};

function findFailure(report: CheckReport): StageFailure | null {
  for (const stage of STAGES) {
    const result: BaseResult | undefined = report[stage];
    if (!result || result.skipped) continue;
    if (!result.ok) {
      return {
        stage,
        code: result.error?.code,
        message: result.error?.message,
        status: stage === "http" ? report.http?.status : undefined,
      };
    }
  }
  return null;
}

function addresses(report: CheckReport): string[] {
  const list = report.dns?.addresses;
  return Array.isArray(list) ? list : [];
}

function localOnlySummary(f: StageFailure): string {
  switch (f.stage) {
    case "dns":
      return "Your network can't resolve this domain, but the control server can. Likely causes: your DNS resolver, DNS blocking by your ISP or network, or a local DNS/hosts setting.";
    case "tcp":
      return "Your network resolves the domain but can't open a connection to it, while the control server can. Likely causes: a firewall, an ISP block, or your network dropping traffic to that address.";
    case "tls":
      return "The connection opens from your side, but the secure (TLS) handshake fails there only. Likely causes: HTTPS interception by your network, a wrong system clock, or a middlebox tampering with the connection.";
    case "http":
      return f.status
        ? `The site answered your network with HTTP ${f.status} but served the control server normally. It may be blocking your IP address or region.`
        : "Your connection and TLS work, but the HTTP request itself fails only from your side.";
  }
}

export function diagnose(local: CheckReport, control: CheckReport): Verdict {
  if (local.invalid || control.invalid) {
    return {
      code: "INVALID_URL",
      severity: "fail",
      title: "That doesn't look like a valid URL",
      summary: "The address couldn't be parsed. Try something like example.com or https://example.com.",
      notes: [],
    };
  }

  const lf = findFailure(local);
  const cf = findFailure(control);
  const notes: string[] = [];

  const la = addresses(local);
  const ca = addresses(control);
  if (lf && la.length && ca.length && !la.some((a) => ca.includes(a))) {
    notes.push(
      "DNS returned different addresses on your network than on the control server. This can be normal CDN routing, but it can also mean DNS tampering."
    );
  }

  const base = { localFailure: lf ?? undefined, controlFailure: cf ?? undefined, notes };

  if (!lf && !cf) {
    return {
      ...base,
      code: "REACHABLE",
      severity: "ok",
      title: "Reachable from both places",
      summary: "DNS, TCP, TLS and HTTP all succeed from your network and from the control server.",
    };
  }

  if (lf && !cf) {
    return {
      ...base,
      code: `LOCAL_${lf.stage.toUpperCase()}_FAIL`,
      severity: "fail",
      title: `Broken on your side (${LABEL[lf.stage]})`,
      summary: localOnlySummary(lf),
    };
  }

  if (!lf && cf) {
    return {
      ...base,
      code: "CONTROL_ONLY_FAILURE",
      severity: "warn",
      title: "Works for you, fails from outside",
      summary: `The site works from your network but fails at the ${LABEL[cf.stage]} step from the control server. It may be restricted by region, limited to certain networks, or the control server is having trouble reaching it.`,
    };
  }

  // Both failed (lf and cf are non-null here)
  const l = lf as StageFailure;
  const c = cf as StageFailure;

  if (l.stage === c.stage) {
    if (l.stage === "dns" && l.code === "ENOTFOUND" && c.code === "ENOTFOUND") {
      return {
        ...base,
        code: "DOMAIN_NOT_FOUND",
        severity: "fail",
        title: "This domain doesn't exist",
        summary: "Neither your network nor the control server can find this domain in DNS. Check the spelling, or the domain may have expired.",
      };
    }
    if (l.stage === "http" && l.status && l.status === c.status) {
      return {
        ...base,
        code: "HTTP_ERROR_EVERYWHERE",
        severity: "fail",
        title: `The site returns HTTP ${l.status} for everyone`,
        summary:
          l.status >= 500
            ? "The site's server is reachable but erroring. The problem is on the site's end, not your network."
            : "The site is reachable but refuses or can't find this request, from both places. Check the exact URL or whether it needs a login.",
      };
    }
    return {
      ...base,
      code: `DOWN_EVERYWHERE_${l.stage.toUpperCase()}`,
      severity: "fail",
      title: `Fails everywhere at ${LABEL[l.stage]}`,
      summary: `The ${LABEL[l.stage]} step fails from both your network and the control server, so the problem is most likely with the site itself, not your connection.`,
    };
  }

  return {
    ...base,
    code: "DIFFERENT_STAGES",
    severity: "fail",
    title: "Fails, but at different steps in each place",
    summary: `From your network it fails at the ${LABEL[l.stage]} step, and from the control server at the ${LABEL[c.stage]} step. That usually means the site has its own problem and your network adds another one.`,
  };
}