import { diagnose } from "./diagnose.js";
import type { CheckReport } from "./checks/index.js";

const base = { input: "example.com", url: "https://example.com/", hostname: "example.com", port: 443 };
const skip = { ok: false, skipped: true };

const okAll: CheckReport = {
  ...base,
  dns: { ok: true, addresses: ["1.1.1.1"] },
  tcp: { ok: true },
  tls: { ok: true },
  http: { ok: true, status: 200 },
};
const dnsNotFound: CheckReport = {
  ...base,
  dns: { ok: false, error: { code: "ENOTFOUND", message: "not found" } },
  tcp: skip,
  tls: skip,
  http: skip,
};
const tcpFail: CheckReport = {
  ...base,
  dns: { ok: true, addresses: ["1.1.1.1"] },
  tcp: { ok: false, error: { code: "ETIMEDOUT", message: "timed out" } },
  tls: skip,
  http: skip,
};
const http403: CheckReport = {
  ...okAll,
  http: { ok: false, status: 403 },
};
const http503: CheckReport = {
  ...okAll,
  http: { ok: false, status: 503 },
};

const cases: [string, CheckReport, CheckReport, string][] = [
  ["both ok", okAll, okAll, "REACHABLE"],
  ["local DNS fails", dnsNotFound, okAll, "LOCAL_DNS_FAIL"],
  ["control TCP fails", okAll, tcpFail, "CONTROL_ONLY_FAILURE"],
  ["domain missing", dnsNotFound, dnsNotFound, "DOMAIN_NOT_FOUND"],
  ["down everywhere", tcpFail, tcpFail, "DOWN_EVERYWHERE_TCP"],
  ["local HTTP 403", http403, okAll, "LOCAL_HTTP_FAIL"],
  ["mixed failures", tcpFail, http503, "DIFFERENT_STAGES"],
];

for (const [name, local, control, expected] of cases) {
  const v = diagnose(local, control);
  const mark = v.code === expected ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}: ${v.code} (expected ${expected})`);
}