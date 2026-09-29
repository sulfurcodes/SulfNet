import tls from "node:tls";
import net from "node:net";
import type { TlsResult } from "./types.js";

export function checkTls(
  hostname: string,
  ip: string,
  port: number,
  timeoutMs = 5000,
): Promise<TlsResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const options: tls.ConnectionOptions = {
      host: ip,
      port,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    };
    if (!net.isIP(hostname)) options.servername = hostname;

    const socket = tls.connect(options);
    let done = false;

    const finish = (result: TlsResult) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ...result, ms: Date.now() - start });
    };

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const authError = socket.authorizationError
        ? String(socket.authorizationError)
        : undefined;
      finish({
        ok: socket.authorized,
        protocol: socket.getProtocol(),
        validTo: cert.valid_to,
        issuer: Array.isArray(cert.issuer?.O)
          ? cert.issuer.O.join(", ")
          : cert.issuer?.O,
        error: authError ? { code: authError, message: authError } : undefined,
      });
    });
    socket.once("timeout", () =>
      finish({
        ok: false,
        error: { code: "ETIMEDOUT", message: "TLS handshake timed out" },
      }),
    );
    socket.once("error", (err: NodeJS.ErrnoException) =>
      finish({ ok: false, error: { code: err.code, message: err.message } }),
    );
  });
}
