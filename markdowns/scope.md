# SulfNet — Final MVP Specification (v5)

### Code-ready edition — Gemma via hosted API

v5 changes one decision: Gemma is called through the **hosted API (Google AI Studio)** only. The self-hosted/Ollama path is removed. Nothing else in scope changed. Everything from v4 (data shapes, decision table, error states, CORS notes) carries over as-is.

Scoped for an 8-hour hackathon. SSRF hardening / rate limiting / configurable timeouts are not tracked deliverables.

---

## 1. Project overview (unchanged)

A network diagnostics tool that answers **"Why can't I reach this website?"** by running the same checks — DNS → TCP → TLS → HTTP — from two vantage points at once:

1. **Local Probe** — runs from the user's own machine/network via a local Node.js agent.
2. **Control Probe** — runs from an external server.

The results are compared to diagnose whether a failure looks like local network interference, a server-side/global issue, or is inconclusive. The tool never claims censorship or blocking is *proven* — it reports "possible local network interference," not "your ISP is blocking this."

---

## 2. Scope (locked)

Two screens only:

### Screen 1 — Home
- URL input field, "Run Diagnostic" button
- On click: kicks off local probe + control probe concurrently
- While running: loading state with status messages that rotate every 2–3 seconds
- Once both probes + comparison + Gemma explanation are ready: a **"View Diagnosis"** button appears (see §7 for what happens if a probe fails or the URL is bad)

### Screen 2 — Diagnosis
- Target URL, a Local-vs-Control results table (DNS/TCP/TLS/HTTP), diagnosis verdict, Gemma explanation paragraph, "Run another check" button

No history, no accounts, no multi-page navigation, no settings.

---

## 3. What we are deliberately NOT building

```
❌ Proxy marketplace / VPN integration / browser extension / mobile app
❌ Global censorship map
❌ Machine learning–based diagnosis (the DNS/TCP/TLS/HTTP verdict stays rule-based)
❌ Traceroute / BGP analysis / packet capture
❌ IPv6, multiple cloud regions, large URL databases
❌ User accounts, auth, RBAC
❌ PostgreSQL, Redis, Kafka, Kubernetes
❌ Scan history / multi-screen dashboard
❌ Next.js / SSR / client-side routing libraries
❌ Flutter (any target)
❌ Self-hosted / local Gemma (Ollama etc.) — hosted API only
❌ SSRF hardening, request rate limiting, configurable timeouts as tracked deliverables (a basic fixed per-stage timeout still exists, see §5)
```

---

## 4. Architecture

```
                         REACT FRONTEND
                         (Vite, browser)
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             LOCAL AGENT           CONTROL SERVER
            127.0.0.1:8787        cloud-hosted
                    │                   │
                    ▼                   │
             User's network             │
                    │                   ▼
                    │            External network
                    │                   │
                    └─────────┬─────────┘
                              ▼
                       Comparison engine
                     (rule-based verdict)
                              │
                              ▼
                    CONTROL SERVER ──► Gemma API
                  (verdict → explanation text)   (Google AI Studio, hosted)
                              │
                              ▼
                         React UI
```

- **`apps/web`** — React (Vite). Calls local agent + control server, renders both screens, does no raw networking itself.
- **`apps/local-agent`** — Node/Express, `127.0.0.1:8787` only, never public.
- **`apps/control`** — Node/Express, cloud-hosted. Hosts the comparison engine and the `/api/explain` endpoint, which calls the Gemma API. The API key lives only here.
- **`packages/probe-engine`** — shared DNS/TCP/TLS/HTTP probe code used by both.

Tech stack: React + Vite + TypeScript, Tailwind + shadcn/ui, Framer Motion, Node/Express, Gemma (hosted API). Design system: Palette C, neo-brutalist — see the separate design-system doc.

---

## 5. Probe result shape

Every stage result has the same shape, whether it's DNS/TCP/TLS/HTTP or local/control:

```ts
type StageStatus = "pass" | "fail" | "skipped";

interface StageResult {
  status: StageStatus;
  latencyMs: number | null;   // null when skipped
  error: string | null;       // e.g. "timeout", "ECONNREFUSED", null on pass
  detail: Record<string, any> | null; // stage-specific extras, see below
}
```

Stage-specific `detail` (best-effort, keep minimal):
- `dns` → `{ resolvedIp }`
- `tcp` → `{ port }`
- `tls` → `{ protocol }` (e.g. `"TLSv1.3"`)
- `http` → `{ statusCode }`

**Sequencing:** stages run in order DNS → TCP → TLS → HTTP. The moment one fails, every later stage for that vantage point is recorded as `"skipped"` — matches the mockup's "— n/a" cells.

**Timeout:** each stage gets a short fixed timeout (a few seconds) so a hung connection resolves as `status: "fail", error: "timeout"` instead of hanging the whole diagnostic. Fixed constant in probe-engine, not configurable.

Full probe response (what both `/probe` endpoints return):

```json
{
  "target": "https://example.com",
  "stages": {
    "dns":  { "status": "pass", "latencyMs": 21, "error": null, "detail": { "resolvedIp": "93.184.216.34" } },
    "tcp":  { "status": "pass", "latencyMs": 37, "error": null, "detail": { "port": 443 } },
    "tls":  { "status": "pass", "latencyMs": 64, "error": null, "detail": { "protocol": "TLSv1.3" } },
    "http": { "status": "pass", "latencyMs": 142, "error": null, "detail": { "statusCode": 200 } }
  },
  "overall": "reachable"
}
```

Failure example (the "TCP timeout" mockup case):

```json
{
  "target": "https://some-site.com",
  "stages": {
    "dns":  { "status": "pass", "latencyMs": 22, "error": null, "detail": { "resolvedIp": "203.0.113.5" } },
    "tcp":  { "status": "fail", "latencyMs": 3000, "error": "timeout", "detail": null },
    "tls":  { "status": "skipped", "latencyMs": null, "error": null, "detail": null },
    "http": { "status": "skipped", "latencyMs": null, "error": null, "detail": null }
  },
  "overall": "failed_at_tcp"
}
```

`overall` is always either `"reachable"` or `"failed_at_<stage>"` (the first stage that failed).

---

## 6. Comparison engine — full decision table

Input: local's `overall` + control's `overall`. Output: a verdict.

| Local | Control | Verdict | Message |
|---|---|---|---|
| reachable | reachable | `reachable` | "Website appears reachable" |
| failed at stage X | reachable | `local_interference` | "Possible local network interference" (failed stage: X) |
| reachable | failed at stage Y | `control_side_issue` | "Your network reached it fine — the control probe couldn't. Likely an issue on the control server's side, not yours." |
| failed at stage X | failed at same stage X | `global_issue` | "The site appears unreachable from both locations — likely a server-side issue, not local interference." |
| failed at stage X | failed at stage Y (X ≠ Y) | `inconclusive` | "Both locations had trouble, but at different stages — inconclusive; may be two unrelated issues." |

Verdict object passed to `/api/explain` and used to render the Diagnosis screen:

```json
{
  "target": "https://some-site.com",
  "verdict": "local_interference",
  "failedStage": "tcp",
  "local": { "...": "full probe response as above" },
  "control": { "...": "full probe response as above" }
}
```

(`failedStage` is `null` for the `reachable` verdict.)

---

## 7. UI error / edge states

Only two hard-stop error states on Home — everything else (including a Gemma failure, per §9) degrades gracefully rather than blocking the flow:

1. **Invalid URL** — validate on submit (`new URL(input)` throws, or missing `http(s)://`). Inline error under the input; don't fire any requests.
2. **Local or control probe unreachable** (network error hitting `127.0.0.1:8787` or the control host — the agent itself being unreachable, as opposed to the *target site* failing) — stop the rotating loading text, show an inline error ("Couldn't reach the local agent — make sure `npm run agent` is running" / "Couldn't reach the control server"), and offer "Try again" back on Home. Do **not** proceed to Diagnosis with partial data.

The target site itself failing DNS/TCP/TLS/HTTP is not an error state — it's the diagnostic result and flows normally into the Diagnosis screen.

---

## 8. Local dev networking (CORS)

The React dev server (Vite, typically `http://localhost:5173`) calls the local agent (`http://127.0.0.1:8787`) and the control server directly from the browser, so both must send CORS headers:

- **Local agent:** `Access-Control-Allow-Origin: http://localhost:5173` (or `*` — fine for an 8-hour hackathon) on `/probe`.
- **Control server:** same, on `/api/probe` and `/api/explain`.

If the frontend ever gets tunneled over HTTPS for the demo (e.g. ngrok) while still hitting `127.0.0.1`, Chrome's Private Network Access check may also require `Access-Control-Allow-Private-Network: true` on the preflight response. Harmless to add now.

---

## 9. Gemma integration (hosted API)

**Flow:** rule-based verdict (§6) → frontend `POST /api/explain` on the control server → control server calls the Gemma API → returns a 2–4 sentence plain-language paragraph → shown under the verdict badge on Diagnosis.

**Setup:**
1. Create an API key in Google AI Studio.
2. Store it as an environment variable on the control server only (e.g. `GEMINI_API_KEY`) — never in the React app, the local agent, or the repo. Add `.env` to `.gitignore`.
3. Pick the model from AI Studio's model list and put it in a second env var (e.g. `GEMMA_MODEL`) rather than hardcoding it, so swapping to a smaller/faster Gemma variant is a config change, not a code change. A small/lightweight variant is plenty for a 2–4 sentence paragraph and keeps latency low for the demo.
4. Do this first thing (Block 1) so any key/quota/model-name problem surfaces early, not during final polish.

**Call shape:** the control server makes a server-side HTTPS request to the Generative Language API for the chosen model (`generateContent`); check AI Studio's current docs for the exact endpoint and request body since model names and fields change. Set a hard timeout on this call (fixed constant, e.g. ~8s) so the fallback below actually fires instead of hanging the "View Diagnosis" button.

**Prompt:** put all instructions in the single user turn rather than relying on a separate system-instruction field, since some Gemma models on the hosted API don't accept system instructions.

```
You explain network diagnostic results to a non-technical user in 2–4 sentences.
Never state that censorship or blocking is proven — use cautious language
("possible", "appears") rather than definitive claims.

Verdict: local_interference
Failed stage: tcp
Local result: dns=pass, tcp=fail (timeout), tls=skipped, http=skipped
Control result: dns=pass, tcp=pass, tls=pass, http=pass

Explain what this means in plain language.
```

**Fallback:** if the API call errors, times out, or returns empty text, respond with a static template built from the verdict's `message` column in §6. The frontend never needs to know which path produced the text. Optionally return `{ explanation, source: "gemma" | "fallback" }` so you can tell during testing which one you're seeing.

**Free-tier note:** the hosted API has rate limits. A handful of test runs plus a demo is normally fine, but avoid wiring anything that calls Gemma in a loop or on every keystroke — one call per completed diagnostic only.

---

## 10. API contracts

```
Local agent:
  GET  http://127.0.0.1:8787/probe?url=<target>
       → probe response (§5)

Control server:
  GET  https://<control-host>/api/probe?url=<target>
       → probe response (§5)

  POST https://<control-host>/api/explain
       body: verdict object (§6)
       → { explanation: "<2-4 sentence text>", source: "gemma" | "fallback" }
```

---

## 11. Build plan (condensed)

| Block | Focus |
|---|---|
| 1 | Get the Gemma API key working with a hello-world call from a scratch Node script (confirms key, model name, quota). In parallel, `probe-engine`: DNS/TCP/TLS/HTTP checks against known-good and known-bad URLs, matching the §5 shape exactly (incl. `skipped` stages and the fixed per-stage timeout). |
| 2 | Local agent + control server wired around `probe-engine`, CORS headers in place (§8). Manually diff local vs control JSON. |
| 3 | Comparison engine implementing the full §6 decision table (all five rows). |
| 4 | React shell: Home screen (URL validation + the two error states from §7), rotating loading text, design-system styling. |
| 5 | Diagnosis screen (table + verdict), `/api/explain` wired to the Gemma API with timeout + static fallback, then final polish + demo script. |

---

## 12. Definition of done

```
[✓] Gemma API key + model configured via env vars on the control server only
[✓] URL input + validation on Home screen (invalid-URL error state)
[✓] Local DNS/TCP/TLS/HTTP probe, matching the §5 JSON shape
[✓] Control DNS/TCP/TLS/HTTP probe, matching the §5 JSON shape
[✓] Local/control-agent-unreachable error state on Home
[✓] Rotating loading messages while probes run
[✓] "View Diagnosis" button appears once probes + comparison + Gemma are ready
[✓] Local/control comparison table on Diagnosis screen
[✓] All 5 rows of the §6 decision table implemented, not just the local-interference case
[✓] Gemma-generated explanation paragraph via the hosted API, with timeout + static fallback
[✓] Presentable, polished 2-screen React UI matching the design system
```

Anything beyond this is optional and should not be attempted before the above is solid.