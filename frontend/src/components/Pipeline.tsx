import { Fragment } from "react";
import type { CheckReport, Stage, StageResult } from "../types";

const STAGES: { key: Stage; label: string }[] = [
  { key: "dns", label: "DNS" },
  { key: "tcp", label: "TCP" },
  { key: "tls", label: "TLS" },
  { key: "http", label: "HTTP" },
];

type NodeState = "pass" | "fail" | "skip";

function stateOf(r?: StageResult): NodeState {
  if (!r || r.skipped) return "skip";
  return r.ok ? "pass" : "fail";
}

function Row({ title, report }: { title: string; report: CheckReport }) {
  const firstFail = STAGES.find((s) => stateOf(report[s.key]) === "fail")?.key;

  return (
    <div>
      <div className="pipe-title mono">{title}</div>
      <div className="pipe-track">
        {STAGES.map(({ key, label }, i) => {
          const r = report[key];
          const state = stateOf(r);
          const timing =
            state === "skip" ? "skipped" : typeof r?.ms === "number" ? `${r.ms} ms` : "";

          return (
            <Fragment key={key}>
              {i > 0 && (
                <span className="pipe-arrow" aria-hidden="true">
                  →
                </span>
              )}
              <div className={`pipe-node pipe-node--${state}`}>
                {firstFail === key && <span className="pipe-break mono">BREAKS HERE</span>}
                <span className="pipe-label">{label}</span>
                <span className="pipe-ms mono">{timing}</span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function Pipeline({ local, control }: { local: CheckReport; control: CheckReport }) {
  return (
    <div className="pipeline">
      <Row title="Your network" report={local} />
      <Row title="Control server" report={control} />
    </div>
  );
}