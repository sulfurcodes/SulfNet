import type { CheckReport, Stage, StageResult } from "../types";

const STAGES: { key: Stage; label: string }[] = [
  { key: "dns", label: "DNS" },
  { key: "tcp", label: "TCP" },
  { key: "tls", label: "TLS" },
  { key: "http", label: "HTTP" },
];

function detail(stage: Stage, r?: StageResult): string {
  if (!r) return "";
  if (r.skipped) return "not run";
  if (r.error?.code) return r.error.code;
  if (stage === "dns" && r.addresses?.length) return r.addresses[0];
  if (stage === "tls" && r.protocol) return r.protocol;
  if (stage === "http" && r.status) return `HTTP ${r.status}`;
  return "";
}

function Cell({ stage, result }: { stage: Stage; result?: StageResult }) {
  if (!result) return <td>-</td>;

  const skipped = Boolean(result.skipped);
  const badgeClass = skipped ? "badge--skip" : result.ok ? "badge--pass" : "badge--fail";
  const badgeText = skipped ? "SKIPPED" : result.ok ? "PASS" : "FAIL";
  const meta = [typeof result.ms === "number" ? `${result.ms} ms` : "", detail(stage, result)]
    .filter(Boolean)
    .join(" · ");

  return (
    <td>
      <span className={`badge ${badgeClass}`}>{badgeText}</span>
      {meta && <div className="cell-meta">{meta}</div>}
    </td>
  );
}

function differs(a?: StageResult, b?: StageResult): boolean {
  if (!a || !b || a.skipped || b.skipped) return false;
  return a.ok !== b.ok;
}

interface ResultsTableProps {
  local: CheckReport;
  control: CheckReport;
}

export default function ResultsTable({ local, control }: ResultsTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Your network</th>
            <th>Control server</th>
          </tr>
        </thead>
        <tbody>
          {STAGES.map(({ key, label }) => (
            <tr key={key} className={differs(local[key], control[key]) ? "mismatch" : undefined}>
              <td className="stage-name">{label}</td>
              <Cell stage={key} result={local[key]} />
              <Cell stage={key} result={control[key]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}