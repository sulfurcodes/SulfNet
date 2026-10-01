// frontend/src/components/ProofPanel.tsx
import { useState } from "react";
import type { CSSProperties } from "react";
import type { Leaning, ProofResponse } from "../proof.types";

const AGENT = "http://127.0.0.1:8787";

// Uses your theme variables if they exist; falls back to Palette C (light).
const ink = "var(--ink, #000000)";
const paper = "var(--paper, #FFFFFF)";
const RED = "#FF3B30";
const YELLOW = "#FFD400";
const TEAL = "#00C2A8";

const box: CSSProperties = {
  border: `3px solid ${ink}`,
  boxShadow: `6px 6px 0 ${ink}`,
  background: paper,
  color: ink,
};

const leanColor: Record<Leaning, string> = {
  local: RED,
  neutral: TEAL,
  inconclusive: YELLOW,
};

const leanText: Record<Leaning, string> = {
  local: "points at your network",
  neutral: "no local problem",
  inconclusive: "couldn't tell",
};

type Phase = "idle" | "loading" | "done" | "error";

export default function ProofPanel({ url }: { url: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [proof, setProof] = useState<ProofResponse | null>(null);

  async function verify() {
    setPhase("loading");
    try {
      const r = await fetch(`${AGENT}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setProof((await r.json()) as ProofResponse);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  return (
    <section style={{ display: "grid", gap: 20, fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button
          onClick={verify}
          disabled={phase === "loading"}
          style={{
            ...box,
            background: YELLOW,
            color: "#000",
            padding: "14px 22px",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: 16,
            cursor: phase === "loading" ? "wait" : "pointer",
          }}
        >
          {phase === "loading" ? "Running counter-tests…" : "VERIFY VERDICT"}
        </button>
        <span style={{ maxWidth: 420, fontSize: 15 }}>
          Changes one variable at a time and checks whether the verdict still holds.
        </span>
      </div>

      {phase === "error" && (
        <div style={{ ...box, background: RED, color: "#000", padding: 16 }}>
          Couldn't run the counter-tests. Check that the local agent and the control server are
          both running, then try again.
        </div>
      )}

      {phase === "done" && proof && (
        <>
          {/* Evidence meter: one block per usable test */}
          <div style={{ ...box, padding: 18 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {Array.from({ length: proof.total }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 22,
                    border: `3px solid ${ink}`,
                    background: i < proof.supporting ? RED : paper,
                  }}
                />
              ))}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
              {proof.supporting} of {proof.total} tests point to a problem local to this network
            </div>
            <h3 style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.1 }}>{proof.likelyCause}</h3>
          </div>

          {/* Counter-tests, local vs control */}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {proof.tests.map((t) => (
              <article key={t.id} style={{ ...box, padding: 0 }}>
                <header
                  style={{
                    background: leanColor[t.leaning],
                    color: "#000",
                    borderBottom: `3px solid ${ink}`,
                    padding: "8px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontWeight: 700,
                  }}
                >
                  <span>{t.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500 }}>
                    {leanText[t.leaning]}
                  </span>
                </header>
                <div style={{ padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
                  <Row k="you" v={t.local} />
                  <Row k="control" v={t.control} />
                  <p style={{ margin: "6px 0 0" }}>{t.conclusion}</p>
                </div>
              </article>
            ))}
          </div>

          {/* Gemma / fallback explanation */}
          {proof.explanation && (
            <div style={{ ...box, padding: 18 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 6 }}>
                {proof.explanationSource === "gemma" ? "Explained by Gemma" : "Summary"}
              </div>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, maxWidth: "70ch" }}>
                {proof.explanation}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
      <span style={{ minWidth: 58, opacity: 0.6 }}>{k}</span>
      <span style={{ wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}