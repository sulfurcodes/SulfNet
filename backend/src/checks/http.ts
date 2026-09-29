import type { HttpResult } from './types.js';

type FetchError = Error & {
  code?: string;
  cause?: { code?: string; message?: string };
};

export async function checkHttp(url: string, timeoutMs = 8000): Promise<HttpResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'SulfNet/0.1' },
    });
    res.body?.cancel().catch(() => {});
    return {
      ok: res.status < 400,
      ms: Date.now() - start,
      status: res.status,
      location: res.headers.get('location') ?? undefined,
    };
  } catch (err) {
    const e = err as FetchError;
    const code = e.name === 'AbortError' ? 'ETIMEDOUT' : (e.cause?.code ?? e.code ?? 'EFETCH');
    return {
      ok: false,
      ms: Date.now() - start,
      error: { code, message: e.cause?.message ?? e.message },
    };
  } finally {
    clearTimeout(timer);
  }
}