import type { CheckReport, Stage, StageResult } from "../types";
import CountUp from "./CountUp";

const STAGES: { key: Stage; label: string }[] = [
  { key: "dns", label: "DNS" },
  { key: "tcp", label: "TCP" },
  { key: "tls", label: "TLS" },
  { key: "http", label: "HTTP" },
];

type Who = "local" | "control";

interface Bar {
  ms?: number;
  state: "pass" | "fail" | "skip";
}

function barOf(r?: StageResult): Bar {
  if (!r || r.skipped) return { state: "skip" };
  return { ms: r.ms, state: r.ok ? "pass" : "fail" };
}

function gap(l: Bar, c: Bar) {
  if (typeof l.ms !== "number" || typeof c.ms !== "number") return null;
  const diff = l.ms - c.ms;
  const hi = Math.max(l.ms, c.ms);
  const lo = Math.max(1, Math.min(l.ms, c.ms));
  const ratio = hi / lo;
  return { diff, ratio, notable: Math.abs(diff) >= 50 && ratio >= 2 };
}

function total(report: CheckReport): number {
  return STAGES.reduce((sum, { key }) => {
    const r = report[key];
    return sum + (r && !r.skipped && typeof r.ms === "number" ? r.ms : 0);
  }, 0);
}

function BarLine({
  who,
  bar,
  max,
  delay,
}: {
  who: Who;
  bar: Bar;
  max: number;
  delay: number;
}) {
  const label = who === "local" ? "YOU" : "CTRL";

  if (bar.state === "skip" || typeof bar.ms !== "number") {
    return (
      <div className="lat-line">
        <span className="lat-who mono">{label}</span>
        <div className="lat-track" />
        <span className="lat-ms lat-ms--skip mono">skipped</span>
      </div>
    );
  }

  const pct = Math.max(2, (bar.ms / max) * 100);
  const kind = bar.state === "fail" ? "fail" : who;

  return (
    <div className="lat-line">
      <span className="lat-who mono">{label}</span>
      <div className="lat-track">
        <div
          className={`lat-bar lat-bar--${kind}`}
          style={{ width: `${pct}%`, animationDelay: `${delay}ms` }}
        />
      </div>
      <span className="lat-ms mono">{bar.ms} ms</span>
    </div>
  );
}

export default function LatencyChart({
  local,
  control,
}: {
  local: CheckReport;
  control: CheckReport;
}) {
  const rows = STAGES.map(({ key, label }) => {
    const l = barOf(local[key]);
    const c = barOf(control[key]);
    return { key, label, l, c, g: gap(l, c) };
  });

  const values = rows
    .flatMap((r) => [r.l.ms, r.c.ms])
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const localTotal = total(local);
  const controlTotal = total(control);
  const totalDiff = localTotal - controlTotal;

  const biggest = rows
    .filter((r) => r.g)
    .sort((a, b) => Math.abs(b.g!.diff) - Math.abs(a.g!.diff))[0];

  let insight = "There isn't enough timing data to compare the two networks.";
  if (biggest?.g) {
    const d = biggest.g.diff;
    insight =
      Math.abs(d) < 20
        ? "Timing is almost identical from both places."
        : `Biggest difference: ${biggest.label} is ${Math.abs(d)} ms ${d > 0 ? "slower" : "faster"} on your network than on the control server.`;
  }

  return (
    <div>
      <h3 className="section-title mono">Latency breakdown</h3>

      <div className="lat-stats">
        <div className="lat-stat lat-stat--local">
          <span className="lat-stat__label mono">Your network</span>
          <span className="lat-stat__value">
            <CountUp value={localTotal} suffix=" ms" />
          </span>
        </div>
        <div className="lat-stat lat-stat--control">
          <span className="lat-stat__label mono">Control server</span>
          <span className="lat-stat__value">
            <CountUp value={controlTotal} suffix=" ms" />
          </span>
          <span className="lat-stat__sub mono">
            {totalDiff === 0
              ? "same total"
              : `you: ${totalDiff > 0 ? "+" : "-"}${Math.abs(totalDiff)} ms`}
          </span>
        </div>
      </div>

      <div className="lat-card">
        <div className="lat-legend mono">
          <span>
            <i className="lat-swatch lat-swatch--local" /> Your network
          </span>
          <span>
            <i className="lat-swatch lat-swatch--control" /> Control server
          </span>
          <span>
            <i className="lat-swatch lat-swatch--fail" /> Failed step
          </span>
        </div>

        {rows.map((row, i) => (
          <div className="lat-group" key={row.key}>
            <div className="lat-head">
              <span className="lat-stage">{row.label}</span>
              {row.g && (
                <span
                  className={`lat-delta mono${row.g.notable ? " lat-delta--notable" : ""}`}
                >
                  {row.g.diff === 0
                    ? "same"
                    : `${row.g.diff > 0 ? "+" : "-"}${Math.abs(row.g.diff)} ms`}
                  {row.g.notable &&
                    ` · ${row.g.ratio.toFixed(1)}x ${row.g.diff > 0 ? "slower" : "faster"} here`}
                </span>
              )}
            </div>
            <BarLine who="local" bar={row.l} max={max} delay={i * 90} />
            <BarLine who="control" bar={row.c} max={max} delay={i * 90 + 45} />
          </div>
        ))}
      </div>

      <p className="legend">{insight}</p>
    </div>
  );
}
