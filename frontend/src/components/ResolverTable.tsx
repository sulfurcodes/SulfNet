import type { CheckReport } from "../types";

interface Answer {
  ok: boolean;
  ms?: number;
  addresses?: string[];
  error?: { code?: string };
}

interface Row {
  key: string;
  label: string;
  local?: Answer;
  control?: Answer;
}

function buildRows(local: CheckReport, control: CheckReport): Row[] {
  const rows: Row[] = [
    {
      key: "system",
      label: "System DNS",
      local: local.dns,
      control: control.dns,
    },
  ];

  const labels = new Map<string, string>();
  for (const r of [
    ...(local.dns?.resolvers ?? []),
    ...(control.dns?.resolvers ?? []),
  ]) {
    labels.set(r.server, `${r.name} (${r.server})`);
  }

  for (const [server, label] of labels) {
    rows.push({
      key: server,
      label,
      local: local.dns?.resolvers?.find((r) => r.server === server),
      control: control.dns?.resolvers?.find((r) => r.server === server),
    });
  }
  return rows;
}

function AnswerCell({ answer }: { answer?: Answer }) {
  if (!answer) return <td>-</td>;

  const count = answer.addresses?.length ?? 0;
  const sorted = [...(answer.addresses ?? [])].sort();
  const detail = answer.ok
    ? `${sorted[0] ?? ""}${count > 1 ? ` +${count - 1}` : ""}`
    : (answer.error?.code ?? "");
  const meta = [typeof answer.ms === "number" ? `${answer.ms} ms` : "", detail]
    .filter(Boolean)
    .join(" · ");

  return (
    <td>
      <span className={`badge ${answer.ok ? "badge--pass" : "badge--fail"}`}>
        {answer.ok ? "ANSWERED" : "FAILED"}
      </span>
      {meta && <div className="cell-meta">{meta}</div>}
    </td>
  );
}

export default function ResolverTable({
  local,
  control,
}: {
  local: CheckReport;
  control: CheckReport;
}) {
  const rows = buildRows(local, control);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Resolver</th>
            <th>Your network</th>
            <th>Control server</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mismatch =
              row.local && row.control && row.local.ok !== row.control.ok;
            return (
              <tr key={row.key} className={mismatch ? "mismatch" : undefined}>
                <td className="stage-name">{row.label}</td>
                <AnswerCell answer={row.local} />
                <AnswerCell answer={row.control} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
