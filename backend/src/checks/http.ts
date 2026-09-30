import type { HttpResult, RedirectHop } from "./types.js";

type FetchError = Error & {
  code?: string;
  cause?: { code?: string; message?: string };
};

const MAX_REDIRECTS = 6;

export async function checkHttp(startUrl: string, timeoutMs = 10000): Promise<HttpResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const hops: RedirectHop[] = [];
  let current = startUrl;

  const failure = (code: string, message: string): HttpResult => ({
    ok: false,
    ms: Date.now() - start,
    hops,
    error: { code, message },
  });

  try {
    for (;;) {
      const hopStart = Date.now();
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SulfNet/0.1" },
      });
      res.body?.cancel().catch(() => {});
      hops.push({ url: current, status: res.status, ms: Date.now() - hopStart });

      const location = res.headers.get("location");
      const isRedirect = res.status >= 300 && res.status < 400 && location;

      if (!isRedirect) {
        return {
          ok: res.status < 400,
          ms: Date.now() - start,
          status: res.status,
          finalUrl: current,
          hops,
        };
      }

      const next = new URL(location, current).href;
      if (hops.some((h) => h.url === next)) {
        return failure("EREDIRECTLOOP", "The site redirects in a loop");
      }
      if (hops.length > MAX_REDIRECTS) {
        return failure("ETOOMANYREDIRECTS", `More than ${MAX_REDIRECTS} redirects`);
      }
      current = next;
    }
  } catch (err) {
    const e = err as FetchError;
    const code = e.name === "AbortError" ? "ETIMEDOUT" : (e.cause?.code ?? e.code ?? "EFETCH");
    return failure(code, e.cause?.message ?? e.message);
  } finally {
    clearTimeout(timer);
  }
}