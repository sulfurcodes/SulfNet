import dns from "node:dns/promises";
import net from "node:net";
import type { DnsResult, ResolverAnswer } from "./types.js";

export async function checkDns(hostname: string, timeoutMs = 5000): Promise<DnsResult> {
  const start = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error("DNS lookup timed out"), { code: "ETIMEOUT" }));
    }, timeoutMs);
  });

  try {
    const records = await Promise.race([dns.lookup(hostname, { all: true }), timeout]);
    return { ok: true, ms: Date.now() - start, addresses: records.map((r) => r.address) };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return { ok: false, ms: Date.now() - start, error: { code: e.code, message: e.message } };
  } finally {
    clearTimeout(timer);
  }
}

const PUBLIC_RESOLVERS = [
  { name: "Cloudflare", server: "1.1.1.1" },
  { name: "Google", server: "8.8.8.8" },
];

async function queryResolver(
  hostname: string,
  resolver: { name: string; server: string },
  timeoutMs: number
): Promise<ResolverAnswer> {
  const start = Date.now();
  const r = new dns.Resolver({ timeout: timeoutMs, tries: 1 });
  r.setServers([resolver.server]);

  try {
    const addresses = await r.resolve4(hostname);
    return { ...resolver, ok: true, ms: Date.now() - start, addresses };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return {
      ...resolver,
      ok: false,
      ms: Date.now() - start,
      error: { code: e.code, message: e.message },
    };
  }
}

// Asks public DNS servers directly, bypassing the system resolver and the hosts file.
export function checkResolvers(hostname: string, timeoutMs = 3000): Promise<ResolverAnswer[]> {
  if (net.isIP(hostname)) return Promise.resolve([]);
  return Promise.all(PUBLIC_RESOLVERS.map((r) => queryResolver(hostname, r, timeoutMs)));
}