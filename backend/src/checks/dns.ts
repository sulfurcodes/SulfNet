import dns from 'node:dns/promises';
import type { DnsResult } from './types.js';

export async function checkDns(hostname: string, timeoutMs = 5000): Promise<DnsResult> {
  const start = Date.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error('DNS lookup timed out'), { code: 'ETIMEOUT' }));
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