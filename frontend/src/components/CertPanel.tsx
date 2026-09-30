import type { CheckReport, StageResult } from "../types";

function certOf(report: CheckReport): StageResult | undefined {
  const t = report.tls;
  return t && !t.skipped && (t.validTo || t.issuer || t.subject) ? t : undefined;
}

function fmtDate(s?: string): string {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function DaysBadge({ days }: { days?: number }) {
  if (typeof days !== "number") return <>-</>;
  if (days < 0) return <span className="badge badge--fail">EXPIRED {Math.abs(days)} DAYS AGO</span>;
  if (days < 30) return <span className="badge badge--warn">{days} DAYS LEFT</span>;
  return <span className="badge badge--pass">{days} DAYS LEFT</span>;
}

export default function CertPanel({ local, control }: { local: CheckReport; control: CheckReport }) {
  const l = certOf(local);
  const c = certOf(control);
  if (!l && !c) return null;

  return (
    <div>
      <h3 className="section-title mono">Certificate</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Detail</th>
              <th>Your network</th>
              <th>Control server</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="stage-name">Issued to</td>
              <td>{l?.subject ?? "-"}</td>
              <td>{c?.subject ?? "-"}</td>
            </tr>
            <tr>
              <td className="stage-name">Issued by</td>
              <td>{l?.issuer ?? "-"}</td>
              <td>{c?.issuer ?? "-"}</td>
            </tr>
            <tr>
              <td className="stage-name">Protocol</td>
              <td>{l?.protocol ?? "-"}</td>
              <td>{c?.protocol ?? "-"}</td>
            </tr>
            <tr>
              <td className="stage-name">Valid until</td>
              <td>{fmtDate(l?.validTo)}</td>
              <td>{fmtDate(c?.validTo)}</td>
            </tr>
            <tr>
              <td className="stage-name">Expiry</td>
              <td>
                <DaysBadge days={l?.daysLeft} />
              </td>
              <td>
                <DaysBadge days={c?.daysLeft} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}