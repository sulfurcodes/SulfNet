import net from 'node:net';
import type { BaseResult } from './types.js';

export function checkTcp(ip: string, port: number, timeoutMs = 5000): Promise<BaseResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.connect({ host: ip, port });
    let done = false;

    const finish = (result: BaseResult) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ...result, ms: Date.now() - start });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () =>
      finish({ ok: false, error: { code: 'ETIMEDOUT', message: 'TCP connection timed out' } })
    );
    socket.once('error', (err: NodeJS.ErrnoException) =>
      finish({ ok: false, error: { code: err.code, message: err.message } })
    );
  });
}