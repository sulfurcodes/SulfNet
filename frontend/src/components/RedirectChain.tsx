import type { CheckReport, RedirectHop } from "../types";

function hopsOf(r: CheckReport): RedirectHop[] {
  return r.http?.hops ?? [];
}

function keyOf(hops: RedirectHop[]): string {
  return hops.map((h) => `${h.status}|${h.url}`).join(">");
}

function badgeClass(status: number): string {
  if (status >= 400) return "badge--fail";
  if (status >= 300) return "badge--warn";
  return "badge--pass";
}

function Chain({ hops, error }: { hops: RedirectHop[]; error?: string }) {
  return (
    <ol className="chain">
      {hops.map((h, i) => (
        <li className="chain__hop" key={`${i}-${h.url}`}>
          <span className="mono">{i > 0 ? "↳" : "•"}</span>
          <span className={`badge ${badgeClass(h.status)}`}>{h.status}</span>
          <span className="chain__url mono">{h.url}</span>
        </li>
      ))}
      {error && (
        <li className="chain__hop">
          <span className="mono">↳</span>
          <span className="badge badge--fail">ERROR</span>
          <span className="chain__url mono">{error}</span>
        </li>
      )}
    </ol>
  );
}

export default function RedirectChain({
  local,
  control,
}: {
  local: CheckReport;
  control: CheckReport;
}) {
  const lh = hopsOf(local);
  const ch = hopsOf(control);
  if (lh.length <= 1 && ch.length <= 1) return null;

  const same = keyOf(lh) === keyOf(ch);
  const lErr = local.http && !local.http.ok ? local.http.error?.code : undefined;
  const cErr = control.http && !control.http.ok ? control.http.error?.code : undefined;

  return (
    <div>
      <h3 className="section-title mono">Redirect chain</h3>
      <div className="chain-panel">
        {same ? (
          <>
            <p className="chain-label mono">Same from both places</p>
            <Chain hops={lh} error={lErr} />
          </>
        ) : (
          <>
            <div>
              <p className="chain-label mono">Your network</p>
              <Chain hops={lh} error={lErr} />
            </div>
            <div>
              <p className="chain-label mono">Control server</p>
              <Chain hops={ch} error={cErr} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}