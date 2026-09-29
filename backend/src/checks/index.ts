import { checkDns } from './dns.js';
import { checkTcp } from './tcp.js';
import { checkTls } from './tls.js';
import { checkHttp } from './http.js';
import type { BaseResult, CheckReport } from './types.js';

export type * from './types.js';

const skipped: BaseResult = { ok: false, skipped: true };

export async function runChecks(rawUrl: string): Promise<CheckReport> {
  let url: URL;
  try {
    url = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { input: rawUrl, invalid: true };
  }

  const isHttps = url.protocol === 'https:';
  const port = Number(url.port) || (isHttps ? 443 : 80);
  const report: CheckReport = { input: rawUrl, url: url.href, hostname: url.hostname, port };

  report.dns = await checkDns(url.hostname);
  if (!report.dns.ok || !report.dns.addresses?.length) {
    return { ...report, tcp: skipped, tls: skipped, http: skipped };
  }

  const ip = report.dns.addresses[0];
  report.tcp = await checkTcp(ip, port);
  if (!report.tcp.ok) return { ...report, tls: skipped, http: skipped };

  report.tls = isHttps ? await checkTls(url.hostname, ip, port) : { ok: true, skipped: true };
  report.http = await checkHttp(url.href);
  return report;
}