// backend/src/checks/proof.ts
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";
import type {
  AsnInfo,
  ProbeSet,
  ProofResponse,
  ProofTest,
  TlsProbe,
} from "../proof.types.js"; // adjust path to wherever you put proof.types.ts

const TIMEOUT = 6000;

/* ───────────────────────── Probes (run on each vantage) ───────────────────────── */

function tlsProbe(
  ip: string,
  hostname: string,
  port: number,
): Promise<TlsProbe> {
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    let socket: tls.TLSSocket | undefined;

    const finish = (r: TlsProbe) => {
      if (done) return;
      done = true;
      socket?.destroy();
      resolve(r);
    };

    try {
      socket = tls.connect(
        {
          host: ip,
          port,
          // SNI must be the hostname, not the IP. Skip it for IP-literal inputs.
          servername: net.isIP(hostname) ? undefined : hostname,
          // We want the cert even when it's invalid, so we can compare it.
          rejectUnauthorized: false,
          timeout: TIMEOUT,
        },
        () => {
          const cert = socket!.getPeerCertificate();
          finish({
            ok: true,
            ip,
            ms: Date.now() - start,
            authorized: socket!.authorized,
            authError: socket!.authorizationError
              ? String(socket!.authorizationError)
              : undefined,
            fingerprint: cert.fingerprint256,
            issuer:
              typeof cert.issuer?.O === "string"
                ? cert.issuer.O
                : typeof cert.issuer?.CN === "string"
                  ? cert.issuer.CN
                  : undefined,
            subject:
              typeof cert.subject?.CN === "string"
                ? cert.subject.CN
                : undefined,
            protocol: socket!.getProtocol() ?? undefined,
          });
        },
      );
      socket.on("timeout", () => finish({ ok: false, ip, error: "ETIMEDOUT" }));
      socket.on("error", (e: NodeJS.ErrnoException) =>
        finish({ ok: false, ip, error: e.code || e.message }),
      );
    } catch (e) {
      finish({ ok: false, ip, error: (e as Error).message });
    }
  });
}

async function dohLookup(hostname: string) {
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(TIMEOUT),
      },
    );
    const j = (await r.json()) as {
      Status: number;
      Answer?: { type: number; data: string }[];
    };
    const addresses = (j.Answer ?? [])
      .filter((a) => a.type === 1)
      .map((a) => a.data);
    return {
      addresses,
      error: addresses.length ? undefined : `DoH status ${j.Status}`,
    };
  } catch (e) {
    return { addresses: [] as string[], error: (e as Error).message };
  }
}

/** ASN via Team Cymru's DNS service (no API key). IPv4 only. */
async function asnLookup(ip: string): Promise<AsnInfo | undefined> {
  try {
    const rev = ip.split(".").reverse().join(".");
    const [[origin]] = await dns.resolveTxt(`${rev}.origin.asn.cymru.com`);
    const asn = origin.split("|")[0].trim().split(" ")[0];
    const [[info]] = await dns.resolveTxt(`AS${asn}.asn.cymru.com`);
    const name = info.split("|").pop()!.trim();
    return { ip, asn: `AS${asn}`, name };
  } catch {
    return undefined;
  }
}

export async function runProbes(
  hostname: string,
  port: number,
  vantage: "local" | "control",
): Promise<ProbeSet> {
  const lookup = (family: 4 | 6) =>
    dns
      .lookup(hostname, { family, all: true })
      .then((r) => r.map((x) => x.address))
      .catch(() => [] as string[]);

  const [v4, v6, doh] = await Promise.all([
    lookup(4),
    lookup(6),
    dohLookup(hostname),
  ]);

  const [ipv4, ipv6, asn] = await Promise.all([
    v4[0]
      ? tlsProbe(v4[0], hostname, port)
      : Promise.resolve<TlsProbe>({ ok: false, error: "NO_A_RECORD" }),
    v6[0]
      ? tlsProbe(v6[0], hostname, port)
      : Promise.resolve<TlsProbe>({ ok: false, error: "NO_AAAA_RECORD" }),
    v4[0] ? asnLookup(v4[0]) : Promise.resolve(undefined),
  ]);

  const systemAddresses = [...v4, ...v6];
  return {
    vantage,
    hostname,
    port,
    systemAddresses,
    systemError: systemAddresses.length ? undefined : "no addresses returned",
    dohAddresses: doh.addresses,
    dohError: doh.error,
    ipv4,
    ipv6,
    asn,
  };
}

/* ───────────────────────── Counter-tests (compare vantages) ───────────────────────── */

const PRIVATE =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const isBogon = (ip: string) => PRIVATE.test(ip) || ip === "::1";

const fmt = (p: TlsProbe) =>
  p.ok ? `OK ${p.ms ?? "?"}ms` : (p.error ?? "FAIL");
const certOf = (p: ProbeSet) =>
  p.ipv4.ok ? p.ipv4 : p.ipv6.ok ? p.ipv6 : undefined;

function testIpFamilies(l: ProbeSet, c: ProbeSet): ProofTest {
  const diffs: string[] = [];
  if (l.ipv4.ok !== c.ipv4.ok) diffs.push("IPv4");
  if (l.ipv6.ok !== c.ipv6.ok) diffs.push("IPv6");
  return {
    id: "ipv4_v6",
    label: "IPv4 vs IPv6",
    local: `v4 ${fmt(l.ipv4)} · v6 ${fmt(l.ipv6)}`,
    control: `v4 ${fmt(c.ipv4)} · v6 ${fmt(c.ipv6)}`,
    leaning: diffs.length ? "local" : "neutral",
    conclusion: diffs.length
      ? `${diffs.join(" and ")} behaves differently on your network than on the control server.`
      : "Both IP families behave the same on both networks, so the failure isn't tied to one of them.",
  };
}

function testControlTls(l: ProbeSet, c: ProbeSet): ProofTest {
  const lok = l.ipv4.ok || l.ipv6.ok;
  const cok = c.ipv4.ok || c.ipv6.ok;
  return {
    id: "control_tls",
    label: "TLS from control server",
    local: lok ? "handshake OK" : "handshake failed",
    control: cok ? "handshake OK" : "handshake failed",
    leaning: cok && !lok ? "local" : "neutral",
    conclusion:
      cok && !lok
        ? "The control server completes TLS but your network doesn't. The site is up; the problem is on your side."
        : !cok && !lok
          ? "TLS fails from both networks, so the site itself may be down."
          : "TLS completes from your network too, so the earlier failure may have been temporary.",
  };
}

function testCert(l: ProbeSet, c: ProbeSet): ProofTest {
  const lc = certOf(l);
  const cc = certOf(c);
  const base = {
    id: "cert_compare" as const,
    label: "Certificate comparison",
    local: lc
      ? `${lc.issuer ?? "?"} · ${lc.fingerprint?.slice(0, 11) ?? "?"}`
      : "no certificate",
    control: cc
      ? `${cc.issuer ?? "?"} · ${cc.fingerprint?.slice(0, 11) ?? "?"}`
      : "no certificate",
  };
  if (!lc || !cc) {
    return {
      ...base,
      leaning: "inconclusive",
      conclusion: "Need a certificate from both networks to compare.",
    };
  }
  if (lc.fingerprint === cc.fingerprint) {
    return {
      ...base,
      leaning: "neutral",
      conclusion: "Both networks receive the identical certificate.",
    };
  }
  if (
    lc.issuer !== cc.issuer ||
    (lc.authorized === false && cc.authorized !== false)
  ) {
    return {
      ...base,
      leaning: "local",
      conclusion: `Your network returns a certificate from a different issuer${
        lc.authError ? ` (${lc.authError})` : ""
      }. That pattern is typical of TLS interception.`,
    };
  }
  return {
    ...base,
    leaning: "neutral",
    conclusion:
      "Different certificate files but the same issuer, which is normal for CDN rotation.",
  };
}

function testDoh(l: ProbeSet, c: ProbeSet): ProofTest {
  const base = {
    id: "doh_dns" as const,
    label: "System DNS vs DoH",
    local: `system: ${l.systemAddresses.slice(0, 2).join(", ") || "none"} · DoH: ${
      l.dohAddresses.slice(0, 2).join(", ") || "none"
    }`,
    control: `system: ${c.systemAddresses.slice(0, 2).join(", ") || "none"}`,
  };
  if (!l.dohAddresses.length) {
    return {
      ...base,
      leaning: "inconclusive",
      conclusion: `DoH lookup failed (${l.dohError ?? "no answer"}), so DNS can't be cross-checked.`,
    };
  }
  if (!l.systemAddresses.length) {
    return {
      ...base,
      leaning: "local",
      conclusion:
        "Your system DNS returns nothing while DoH resolves the name. Your resolver is blocking or failing it.",
    };
  }
  if (l.systemAddresses.some(isBogon)) {
    return {
      ...base,
      leaning: "local",
      conclusion:
        "Your system DNS returned a private or null address. That's a sinkhole answer, not the real site.",
    };
  }
  const known = new Set([
    ...l.dohAddresses,
    ...c.systemAddresses,
    ...c.dohAddresses,
  ]);
  if (!l.systemAddresses.some((ip) => known.has(ip))) {
    return {
      ...base,
      leaning: "local",
      conclusion:
        "Your DNS answer matches neither DoH nor the control server. That can mean tampering, though geo-routed CDNs also do this.",
    };
  }
  return {
    ...base,
    leaning: "neutral",
    conclusion: "System DNS agrees with DoH and the control server.",
  };
}

function testAsn(l: ProbeSet, c: ProbeSet): ProofTest {
  const fa = (a?: AsnInfo) =>
    a ? `${a.ip} · ${a.asn} ${a.name}` : "unavailable";
  const base = {
    id: "asn_compare" as const,
    label: "IP and ASN",
    local: fa(l.asn),
    control: fa(c.asn),
  };
  if (l.asn && isBogon(l.asn.ip)) {
    return {
      ...base,
      leaning: "local",
      conclusion: "Your network resolves the site to a private address.",
    };
  }
  if (!l.asn || !c.asn) {
    return {
      ...base,
      leaning: "inconclusive",
      conclusion: "ASN lookup unavailable on one side.",
    };
  }
  return {
    ...base,
    leaning: "neutral",
    conclusion:
      l.asn.asn === c.asn.asn
        ? "Both networks reach the same provider."
        : "The networks reach different providers. That is usually normal CDN routing, not blocking by itself.",
  };
}

export function buildProof(
  local: ProbeSet,
  control: ProbeSet,
): Omit<ProofResponse, "explanation" | "explanationSource"> {
  const tests = [
    testControlTls(local, control),
    testIpFamilies(local, control),
    testCert(local, control),
    testDoh(local, control),
    testAsn(local, control),
  ];
  const usable = tests.filter((t) => t.leaning !== "inconclusive");
  const flagged = tests.filter((t) => t.leaning === "local");
  const has = (id: string) => flagged.some((t) => t.id === id);

  const likelyCause = has("doh_dns")
    ? "DNS interference on your network"
    : has("cert_compare")
      ? "Certificate / TLS interception"
      : has("ipv4_v6")
        ? "IPv4 / IPv6 path problem on your network"
        : has("control_tls")
          ? "Your network is blocking or breaking this connection"
          : "No sign of a problem local to your network";

  return {
    tests,
    supporting: flagged.length,
    total: usable.length,
    likelyCause,
    why: flagged.length
      ? flagged.map((t) => t.conclusion).join(" ")
      : "Every usable counter-test behaves the same from both networks. The cause is likely the site itself or a temporary fault.",
    localProbes: local,
    controlProbes: control,
  };
}

/** Turn the evidence into a prompt for your existing Gemma call. */
export function proofToPrompt(p: ReturnType<typeof buildProof>): string {
  const lines = p.tests.map(
    (t) =>
      `- ${t.label} [${t.leaning}] local=${t.local} | control=${t.control} → ${t.conclusion}`,
  );
  return [
    "You are explaining a network diagnosis to a non-expert in 3-4 sentences.",
    "Use ONLY this evidence. Say 'likely', never claim certainty. Do not invent causes.",
    `Evidence: ${p.supporting} of ${p.total} tests point to a local-network problem.`,
    `Likely cause: ${p.likelyCause}`,
    ...lines,
  ].join("\n");
}

/* ───────────────────────── Orchestration (runs on the agent) ───────────────────────── */

export async function runProof(
  input: string,
  controlBase: string,
  explain?: (prompt: string) => Promise<string | null>,
): Promise<ProofResponse> {
  const u = new URL(input.includes("://") ? input : `https://${input}`);
  const hostname = u.hostname;
  const port = Number(u.port) || 443;

  const [local, control] = await Promise.all([
    runProbes(hostname, port, "local"),
    fetch(`${controlBase}/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname, port }),
      signal: AbortSignal.timeout(20000),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`control server returned ${r.status}`);
      return (await r.json()) as ProbeSet;
    }),
  ]);

  const proof = buildProof(local, control);

  let explanation: string | null = null;
  if (explain) {
    try {
      explanation = await explain(proofToPrompt(proof));
    } catch {
      explanation = null;
    }
  }
  return {
    ...proof,
    explanation: explanation ?? proof.why,
    explanationSource: explanation ? "gemma" : "fallback",
  };
}
