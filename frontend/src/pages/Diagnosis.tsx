import ResultsTable from "../components/ResultsTable";
import type { DiagnoseResponse } from "../types";

interface DiagnosisProps {
  result: DiagnoseResponse;
  onBack: () => void;
}

export default function Diagnosis({ result, onBack }: DiagnosisProps) {
  const { verdict, local, control, explanation, explanationSource } = result;

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

      <div>
        <h3 className="section-title mono">Your network vs control server</h3>
        <ResultsTable local={local} control={control} />
        <p className="legend">Yellow rows are where your network and the control server disagree.</p>
      </div>

      <div className="actions">
        <button className="btn" type="button" onClick={onBack}>
          ← Run another
        </button>
      </div>
    </section>
  );
}