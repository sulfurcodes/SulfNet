import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Phase } from "../types";

const MESSAGES = [
  "Asking your DNS resolver...",
  "Knocking on the TCP port...",
  "Shaking hands over TLS...",
  "Sending an HTTP request...",
  "Comparing notes with the control server...",
];

function LoadingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((n) => (n + 1) % MESSAGES.length), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="status-line mono">
      <span className="blink">■</span>
      {MESSAGES[index]}
    </p>
  );
}

interface HomeProps {
  phase: Phase;
  error: string | null;
  onRun: (url: string) => void;
  onViewDiagnosis: () => void;
}

export default function Home({ phase, error, onRun, onViewDiagnosis }: HomeProps) {
  const [url, setUrl] = useState("");
  const loading = phase === "loading";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    onRun(trimmed);
  }

  return (
    <section className="stack">
      <div className="card hero">
        <h1>Can't reach a website? Find out why.</h1>
        <p>
          Paste a URL. SulfNet checks DNS, TCP, TLS and HTTP from your network and from an outside
          server, then tells you exactly where it breaks.
        </p>
        <form className="url-row" onSubmit={handleSubmit}>
          <input
            className="input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com"
            aria-label="Website URL"
            disabled={loading}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoFocus
          />
          <button className="btn" type="submit" disabled={loading || !url.trim()}>
            {loading ? "Running..." : "Run Diagnostic"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="panel panel--loading" role="status">
          <p className="panel__title">Running checks</p>
          <LoadingText />
        </div>
      )}

      {phase === "done" && (
        <div className="panel panel--done" role="status">
          <p className="panel__title">Diagnostic complete</p>
          <p>Your results are ready.</p>
          <button className="btn btn--white" type="button" onClick={onViewDiagnosis}>
            View Diagnosis →
          </button>
        </div>
      )}

      {phase === "error" && error && (
        <div className="panel panel--error" role="alert">
          <p className="panel__title">Something went wrong</p>
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}