import { useState } from "react";
import Home from "./pages/Home";
import Diagnosis from "./pages/Diagnosis";
import { runDiagnostic } from "./api";
import type { DiagnoseResponse, Phase } from "./types";

type Screen = "home" | "diagnosis";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(url: string) {
    setPhase("loading");
    setError(null);
    setResult(null);
    try {
      const data = await runDiagnostic(url);
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  function handleBack() {
    setScreen("home");
    setPhase("idle");
    setResult(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">SulfNet</div>
        <div className="tagline mono">Why can't I reach it?</div>
      </header>

      {screen === "home" && (
        <Home
          phase={phase}
          error={error}
          onRun={handleRun}
          onViewDiagnosis={() => setScreen("diagnosis")}
        />
      )}

      {screen === "diagnosis" && result && <Diagnosis result={result} onBack={handleBack} />}
    </div>
  );
}