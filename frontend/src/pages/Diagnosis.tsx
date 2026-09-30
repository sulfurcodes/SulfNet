import { useState } from "react";
import Pipeline from "../components/Pipeline";
import LatencyChart from "../components/LatencyChart";
import ResultsTable from "../components/ResultsTable";
import CertPanel from "../components/CertPanel";
import RedirectChain from "../components/RedirectChain";
import ResolverTable from "../components/ResolverTable";
import { buildReportText } from "../report";
import type { DiagnoseResponse } from "../types";

interface DiagnosisProps {
  result: DiagnoseResponse;
  onBack: () => void;
}

type CopyState = "idle" | "copied" | "failed";

export default function Diagnosis({ result, onBack }: DiagnosisProps) {
  const { verdict, local, control, explanation, explanationSource } = result;
  const [copy, setCopy] = useState<CopyState>("idle");

  const hasResolvers =
    (local.dns?.resolvers?.length ?? 0) > 0 || (control.dns?.resolvers?.length ?? 0) > 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildReportText(result));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 2000);
  }

  return (
    <section className="stack">
      <div className={`verdict verdict--${verdict.severity}`}>
        <span className="tag mono">{control.hostname ?? result.url}</span>
        <h2>{verdict.title}</h2>
        <p>{verdict.summary}</p>
        {verdict.notes.length > 0 && (
          <ul className="notes">
            {verdict.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="explain">
        <span className="tag mono">
          {explanationSource === "gemma" ? "Explained by Gemma" : "Explanation"}
        </span>
        {explanation ? (
          <p>{explanation}</p>
        ) : (
          <p>
            The AI explanation isn't available right now, so the verdict above is the full answer.
          </p>
        )}
      </div>

      {verdict.tips.length > 0 && (
        <div className="tips">
          <span className="tag mono">What you can try</span>
          <ol>
            {verdict.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <h3 className="section-title mono">Where it breaks</h3>
        <Pipeline local={local} control={control} />
      </div>

      <LatencyChart local={local} control={control} />

      <div>
        <h3 className="section-title mono">Your network vs control server</h3>
        <ResultsTable local={local} control={control} />
        <p className="legend">Yellow rows are where your network and the control server disagree.</p>
      </div>

      <CertPanel local={local} control={control} />

      <RedirectChain local={local} control={control} />

      {hasResolvers && (
        <div>
          <h3 className="section-title mono">DNS from different resolvers</h3>
          <ResolverTable local={local} control={control} />
          <p className="legend">
            Public DNS servers ignore your router's DNS and your hosts file. If they answer where
            System DNS fails, your DNS is the problem.
          </p>
        </div>
      )}

      <div className="actions">
        <button className="btn" type="button" onClick={onBack}>
          ← Run another
        </button>
        <button className="btn btn--white" type="button" onClick={handleCopy}>
          {copy === "copied" ? "Copied ✓" : copy === "failed" ? "Copy failed" : "Copy report"}
        </button>
      </div>
    </section>
  );
}