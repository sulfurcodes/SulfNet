import type {
  BaseResult,
  CheckReport,
  ResolverAnswer,
} from "./checks/index.js";

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
  tips: string[];
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

function resolverAddresses(report: CheckReport): string[] {
  return (report.dns?.resolvers ?? []).flatMap((r) =>
    r.ok ? (r.addresses ?? []) : [],
  );
}

function resolverNames(report: CheckReport): string[] {
  return (report.dns?.resolvers ?? [])
    .filter((r) => r.ok && r.addresses?.length)
    .map((r) => r.name);
}

// A resolver "answered" if it replied at all, even with "no such domain".
function answered(r: ResolverAnswer): boolean {
  return r.ok || r.error?.code === "ENOTFOUND" || r.error?.code === "ENODATA";
}

function isNonRoutable(ip: string): boolean {
  return (
    ip === "0.0.0.0" || ip === "::" || ip === "::1" || ip.startsWith("127.")
  );
}

// Returns the placeholder address if the local DNS answered with one while public DNS gives a real address.
function sinkholeAddress(
  local: CheckReport,
  control: CheckReport,
): string | null {
  const la = addresses(local);
  if (!la.length || !la.every(isNonRoutable)) return null;

  const fromResolvers = [
    ...resolverAddresses(local),
    ...resolverAddresses(control),
  ];
  const reference = fromResolvers.length ? fromResolvers : addresses(control);
  if (!reference.length || reference.some(isNonRoutable)) return null;

  return la[0];
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

function buildVerdict(
  local: CheckReport,
  control: CheckReport,
): Omit<Verdict, "tips"> {
  if (local.invalid || control.invalid) {
    return {
      code: "INVALID_URL",
      severity: "fail",
      title: "That doesn't look like a valid URL",
      summary:
        "The address couldn't be parsed. Try something like example.com or https://example.com.",
      notes: [],
    };
  }

  const lf = findFailure(local);
  const cf = findFailure(control);
  const sinkhole = lf ? sinkholeAddress(local, control) : null;
  const notes: string[] = [];

  const la = addresses(local);
  const ca = addresses(control);
  const ra = resolverAddresses(local);

  if (lf && la.length && ca.length && !la.some((a) => ca.includes(a))) {
    notes.push(
      "DNS returned different addresses on your network than on the control server. This can be normal CDN routing, but it can also mean DNS tampering.",
    );
  }
  if (
    lf &&
    !sinkhole &&
    la.length &&
    ra.length &&
    !la.some((a) => ra.includes(a))
  ) {
    notes.push(
      "Your system's DNS returned different addresses than public DNS servers (Cloudflare, Google). This can be normal CDN routing, but together with this failure it may mean your DNS is being tampered with.",
    );
  }
  const localResolvers = local.dns?.resolvers ?? [];
  if (
    lf?.stage === "dns" &&
    localResolvers.length &&
    localResolvers.every((r) => !answered(r))
  ) {
    notes.push(
      "Your network may be blocking direct queries to public DNS servers, so that comparison wasn't possible.",
    );
  }

  const base = {
    localFailure: lf ?? undefined,
    controlFailure: cf ?? undefined,
    notes,
  };

  if (!lf && !cf) {
    return {
      ...base,
      code: "REACHABLE",
      severity: "ok",
      title: "Reachable from both places",
      summary:
        "DNS, TCP, TLS and HTTP all succeed from your network and from the control server.",
    };
  }

  if (lf && sinkhole) {
    return {
      ...base,
      code: "LOCAL_DNS_SINKHOLE",
      severity: "fail",
      title: "Your DNS is sending you to a dead end",
      summary: `Your network's DNS answered with a placeholder address (${sinkhole}) instead of the site's real one, while public DNS servers return a real address. That's a common way for a router, ISP, content filter or hosts file to block a site. Try a different DNS server, and check your hosts file.`,
    };
  }

  if (lf && !cf) {
    if (lf.stage === "dns" && resolverNames(local).length > 0) {
      return {
        ...base,
        code: "LOCAL_DNS_RESOLVER_FAIL",
        severity: "fail",
        title: "Your DNS server is the problem",
        summary: `Your network's DNS server can't resolve this domain, but ${resolverNames(local).join(" and ")} can, and so can the control server. Your ISP's or router's DNS is failing or blocking this domain. Switching your DNS server, for example to 1.1.1.1 or 8.8.8.8, should fix it.`,
      };
    }
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
        summary:
          "Neither your network nor the control server can find this domain in DNS. Check the spelling, or the domain may have expired.",
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

function tipsFor(v: Omit<Verdict, "tips">): string[] {
  const l = v.localFailure;

  switch (v.code) {
    case "REACHABLE":
      return [
        "Everything looks good. Rest assured that your connection is working and the site is up.",
      ];
    case "INVALID_URL":
      return [
        "Check the spelling of the address.",
        "Use a full domain name, for example example.com or https://example.com.",
      ];
    case "LOCAL_DNS_SINKHOLE":
      return [
        "Check your hosts file (C:\\Windows\\System32\\drivers\\etc\\hosts on Windows, /etc/hosts on Mac and Linux) and remove any line that points this domain to 0.0.0.0 or 127.0.0.1.",
        "Switch your DNS server to 1.1.1.1 or 8.8.8.8 in your network settings, or turn on Secure DNS in your browser.",
        "On a school, work or public network, a content filter may be blocking this site on purpose.",
      ];
    case "LOCAL_DNS_RESOLVER_FAIL":
      return [
        "Change your DNS server to 1.1.1.1 or 8.8.8.8 in your network settings.",
        "Or turn on Secure DNS (DNS over HTTPS) in your browser settings.",
        "Restart your router, then clear cached DNS answers (run ipconfig /flushdns on Windows).",
      ];
    case "CONTROL_ONLY_FAILURE":
      return [
        "The site works for you, so nothing needs fixing on your side.",
        "If you run this site, check whether its firewall or region rules block outside visitors.",
        "Run the check again in a minute, in case the control server had a temporary problem.",
      ];
    case "DOMAIN_NOT_FOUND":
      return [
        "Check the spelling of the domain.",
        "If the domain is new, DNS changes can take up to 48 hours to spread.",
        "The domain may have expired. A WHOIS lookup shows its status.",
      ];
    case "HTTP_ERROR_EVERYWHERE":
      return (l?.status ?? 0) >= 500
        ? [
            "The site's server is having trouble. Wait a few minutes and try again.",
            "If you run the site, check its server logs and whether the application is running.",
          ]
        : [
            "Check the exact address, including the path after the domain.",
            "The page may need a login, or it may have been moved or removed.",
          ];
    case "DIFFERENT_STAGES":
      return [
        "Start with the failure the control server sees, since that one is on the site's side.",
        "Once that is fixed, run the check again to see whether your network adds a second problem.",
      ];
  }

  if (v.code.startsWith("LOCAL_") && l) {
    switch (l.stage) {
      case "dns":
        return [
          "Check your internet connection and try another website.",
          "Try a different DNS server such as 1.1.1.1 or 8.8.8.8.",
          "Clear cached DNS answers (run ipconfig /flushdns on Windows).",
        ];
      case "tcp":
        return [
          "Test from a different network, such as a phone hotspot. If it works there, your usual network is the cause.",
          "Check whether a firewall or antivirus on your device is blocking the connection.",
          "Try again later, in case your network is having a temporary problem.",
        ];
      case "tls":
        return [
          "Check your device's date and time, because a wrong clock breaks HTTPS.",
          "Turn off antivirus HTTPS scanning or any proxy, then try again.",
          "Test from a different network, since some networks interfere with secure connections.",
        ];
      case "http":
        return [
          "The site may be refusing your IP address or region. Test from a different network.",
          "Try again later, in case you were rate limited.",
          "Check whether the page needs a login.",
        ];
    }
  }

  if (v.code.startsWith("DOWN_EVERYWHERE_") && l) {
    if (/REDIRECT/.test(l.code ?? "")) {
      return [
        "The site keeps redirecting without ever loading. If you run it, check your redirect rules (for example HTTP to HTTPS and www rules fighting each other).",
        "As a visitor, clearing this site's cookies sometimes breaks the loop.",
      ];
    }
    switch (l.stage) {
      case "dns":
        return [
          "If you own the domain, check its DNS records at your registrar.",
          "Otherwise wait a while and try again, since the site's DNS may be down.",
        ];
      case "tcp":
        return [
          "If you run the server, check that it is running and that the port is open in its firewall.",
          "Otherwise wait a while and try again.",
        ];
      case "tls":
        return [
          "If you run the site, fix the certificate (expired, issued for another domain, or missing the intermediate chain).",
          "As a visitor, wait for the owner to fix it instead of bypassing the warning.",
        ];
      case "http":
        return [
          "If you run the site, check the web server and application logs.",
          "Otherwise wait a while and try again.",
        ];
    }
  }

  return [];
}

export function diagnose(local: CheckReport, control: CheckReport): Verdict {
  const verdict = buildVerdict(local, control);
  return { ...verdict, tips: tipsFor(verdict) };
}
