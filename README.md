# SulfNet

> **Why can't I reach it?** Paste a URL and find out which step of the connection breaks, and whether the problem is your network or the site.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-0AE448?style=for-the-badge&logo=greensock&logoColor=black)
![Google Gemma](https://img.shields.io/badge/Google_Gemma-4285F4?style=for-the-badge&logo=google&logoColor=white)

<!-- Add screenshots here, for example:
![Home screen](docs/home.png)
![Diagnosis screen](docs/diagnosis.png)
-->

## The problem

When a website won't load, browsers say almost nothing useful: "This site can't be reached." The cause could be a DNS problem, a firewall, a bad certificate, a blocking ISP, or the site simply being down. Those have completely different fixes, and most people can't tell them apart.

## The idea

SulfNet runs the same four checks from **two places** and compares them:

1. **Your network**, through a small local agent running on your machine.
2. **An outside control server**, which checks the same site from a different network.

If both fail the same way, the site is the problem. If only your side fails, the problem is on your network, and the step where it breaks tells you why.

The four checks follow what a browser actually does:

| Step | What it does | Typical failure |
| --- | --- | --- |
| **DNS** | Turns the name into an IP address | Blocked, poisoned or non-existent domain |
| **TCP** | Opens a connection to that address | Firewall or ISP dropping traffic |
| **TLS** | Secures the connection, checks the certificate | Expired or mismatched certificate, handshake tampering |
| **HTTP** | Asks the site for the page | Server errors, refusals, redirect loops |

## Features

**Diagnosis**
- Four-stage checks (DNS, TCP, TLS, HTTP) from your network and from the control server, with later stages skipped once one fails.
- **Rule-based verdict engine** that compares both reports and picks a cause (see [Verdicts](#verdicts)).
- **Multi-resolver DNS comparison.** Every run also asks Cloudflare (1.1.1.1) and Google (8.8.8.8) directly, bypassing your router's DNS and your hosts file. This separates "your DNS is the problem" from "the site is down".
- **DNS sinkhole detection.** Flags when your DNS answers with a placeholder such as `0.0.0.0` or `127.x` while public DNS returns a real address, a common way to block a site.
- **Redirect chain.** Follows up to 6 redirects hop by hop, detects loops, and shows the chain when it differs between the two vantage points.
- **Certificate details.** Who it was issued to and by, protocol, expiry date, and days left, with warnings for certificates close to expiry or expired.
- **Latency breakdown.** Per-stage timing for both networks side by side, with totals and the biggest difference called out.
- **"What you can try"** fix suggestions matched to the verdict.
- **Gemma explanation.** The verdict is turned into 2 to 3 plain-English sentences by Google Gemma. The rules decide the cause, and Gemma only explains it. If Gemma is unavailable, the rule-based verdict still shows.
- **Copy report** button that puts a plain-text summary on your clipboard.

**Interface**
- Two screens: a Home screen (URL input, run, loading state) and a Diagnosis screen (verdict, pipeline, tables, charts).
- Neo-brutalist design system with light and dark modes (see [Design](#design)).
- A looping network diagram on the Home screen that shows packets passing or dying at each step from both vantage points, plus a "how a page loads" explainer.
- GSAP-driven motion (headline reveal, verdict stamp, staggered sections, pipeline pop-in, count-up totals) and React Bits hover and click effects. All of it respects the reduced-motion setting.

## How it works

```
            ┌────────────────────────────┐
            │   Browser (React + Vite)   │
            └──────┬──────────────┬──────┘
    1. POST /check │              │ 2. POST /diagnose { url, local report }
                   │              │
        ┌──────────▼─────┐   ┌────▼───────────────────────┐
        │   Local agent  │   │       Control server       │
        │ 127.0.0.1:8787 │   │ runs the same checks, then │
        │ checks from    │   │ diagnose.ts (rules) and    │
        │ YOUR network   │   │ gemma.ts (explanation)     │
        └────────────────┘   └────────────────────────────┘
```

1. The browser asks the **local agent** to run the checks from your network.
2. The browser sends that report to the **control server**, which runs the same checks from its own network.
3. `diagnose.ts` compares both reports and produces a verdict, notes, and tips.
4. `gemma.ts` sends Gemma a compact summary of the results and the verdict and gets back the explanation text.
5. The frontend renders the verdict, pipeline, latency chart, tables and more.

### What each check does

- **DNS:** a system lookup (`dns.lookup`, which honors your hosts file) with a 5 s timeout, plus parallel `resolve4` queries to 1.1.1.1 and 8.8.8.8 (3 s, single try). Resolver queries are skipped for IP addresses.
- **TCP:** connects to the first resolved address and port (5 s timeout).
- **TLS:** handshakes with SNI set to the hostname. It collects the certificate even when validation fails, so expired or mismatched certificates show details instead of just an error.
- **HTTP:** `fetch` with manual redirect handling (up to 6 hops, loop detection, 10 s total).
- TLS is skipped for plain `http://` URLs.

### Verdicts

| Code | Meaning |
| --- | --- |
| `REACHABLE` | All four steps pass from both places |
| `LOCAL_DNS_SINKHOLE` | Your DNS returned a placeholder address while public DNS returns a real one |
| `LOCAL_DNS_RESOLVER_FAIL` | Your DNS fails, but Cloudflare, Google and the control server all resolve it |
| `LOCAL_DNS_FAIL`, `LOCAL_TCP_FAIL`, `LOCAL_TLS_FAIL`, `LOCAL_HTTP_FAIL` | Fails only from your network, at that step |
| `CONTROL_ONLY_FAILURE` | Works for you, fails from the control server |
| `DOMAIN_NOT_FOUND` | Neither side can find the domain |
| `HTTP_ERROR_EVERYWHERE` | Both sides get the same HTTP error status |
| `DOWN_EVERYWHERE_<STEP>` | The same step fails from both places |
| `DIFFERENT_STAGES` | Each side fails at a different step |
| `INVALID_URL` | The address couldn't be parsed |

The verdict also carries notes, for example when DNS answers differ between your network and the control server (which can be normal CDN routing, or tampering). Those notes are worded as possibilities, not accusations.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, Express, TypeScript (run with `tsx`) |
| Network checks | Node built-ins: `dns`, `net`, `tls`, `fetch` |
| AI explanation | Google Gemma via the hosted Gemini API (`@google/genai`) |
| Frontend | React, Vite, TypeScript |
| Animation | GSAP (core), React Bits `Magnet` and `ClickSpark`, CSS |
| Fonts | Space Grotesk, JetBrains Mono |

## Project structure

```
SulfNet/
├─ README.md
├─ .gitignore
├─ backend/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ .env.example
│  └─ src/
│     ├─ agent.ts            # local agent (127.0.0.1:8787)
│     ├─ server.ts           # control server (/check, /diagnose)
│     ├─ diagnose.ts         # rule-based verdict and tips
│     ├─ gemma.ts            # Gemma explanation step
│     ├─ test-checks.ts      # run the raw checks from the terminal
│     ├─ test-diagnose.ts    # offline tests for the verdict logic
│     └─ checks/
│        ├─ index.ts         # runs the stages in order
│        ├─ dns.ts           # system DNS and public resolvers
│        ├─ tcp.ts
│        ├─ tls.ts
│        ├─ http.ts          # redirect chain
│        └─ types.ts
└─ frontend/
   ├─ index.html
   └─ src/
      ├─ main.tsx, App.tsx
      ├─ api.ts              # calls the agent and the control server
      ├─ types.ts, report.ts, theme.ts, motion.ts
      ├─ index.css           # design tokens and all styles
      ├─ pages/              # Home.tsx, Diagnosis.tsx
      ├─ components/         # HeroTitle, NetworkHero, HowItWorks, Pipeline,
      │                      # LatencyChart, ResultsTable, CertPanel,
      │                      # RedirectChain, ResolverTable, ThemeToggle, CountUp
      └─ react-bits/         # Magnet.tsx, ClickSpark.tsx
```

## Getting started

**Requirements:** Node.js 18 or newer (the checks use the built-in `fetch`).

```bash
git clone https://github.com/sulfurcodes/SulfNet.git
cd SulfNet
```

### 1. Backend

```bash
cd backend
npm install
```

Create your environment file from the template:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` and add your Gemma key (see [Environment variables](#environment-variables)). The app still works without a key, but the explanation box will show the fallback text.

Start the two backend processes in separate terminals:

```bash
npm run agent     # local agent on http://127.0.0.1:8787
npm run server    # control server on http://localhost:8788
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, type a URL and press **Run Diagnostic**.

### Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `backend` | `npm run agent` | Starts the local agent with file watching |
| `backend` | `npm run server` | Starts the control server with file watching |
| `backend` | `npm run typecheck` | Type-checks the backend |
| `frontend` | `npm run dev` | Starts the Vite dev server |
| `frontend` | `npm run build` | Production build |
| `frontend` | `npx tsc --noEmit` | Type-checks the frontend (`vite build` does not) |

### Environment variables

**Backend (`backend/.env`)**

| Variable | Purpose | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google AI Studio key for the Gemma explanation | none (fallback text is shown) |
| `GEMMA_MODEL` | Gemma model ID to use | `gemma-3-27b-it` |
| `AGENT_PORT` | Local agent port | `8787` |
| `SERVER_PORT` | Control server port (falls back to `PORT`) | `8788` |
| `ALLOWED_ORIGIN` | Frontend origin(s) allowed by CORS, comma-separated | `http://localhost:5173` |

Check which Gemma model IDs your key can use in Google AI Studio. A wrong `GEMMA_MODEL` does not crash anything: the server logs `Gemma request failed` and the app shows the fallback.

**Frontend (optional, `frontend/.env`)**

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_AGENT_URL` | Where the browser finds the local agent | `http://127.0.0.1:8787` |
| `VITE_CONTROL_URL` | Where the browser finds the control server | `http://localhost:8788` |

## API

### Local agent (`127.0.0.1:8787`)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns `{ "ok": true, "role": "agent" }` |
| `POST` | `/check` | Body `{ "url": "example.com" }`. Runs the four checks from this machine and returns the report with `"vantage": "local"` |

### Control server (`:8788`)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns `{ "ok": true, "role": "control" }` |
| `POST` | `/check` | Same as the agent, tagged `"vantage": "control"` |
| `POST` | `/diagnose` | Body `{ "url": "...", "local": <agent report> }`. Runs the checks, builds the verdict and asks Gemma for the explanation |

`POST /diagnose` returns:

```json
{
  "url": "example.com",
  "local": { "...": "agent report" },
  "control": { "...": "control report" },
  "verdict": {
    "code": "REACHABLE",
    "severity": "ok",
    "title": "Reachable from both places",
    "summary": "...",
    "notes": [],
    "tips": ["..."]
  },
  "explanation": "...",
  "explanationSource": "gemma"
}
```

`explanationSource` is `"fallback"` (and `explanation` is `null`) when Gemma is unavailable.

## Testing

Test the verdict logic offline (no network needed). This should print ten `PASS` lines:

```bash
cd backend
npx tsx src/test-diagnose.ts
```

Run the raw checks from the terminal:

```bash
npx tsx src/test-checks.ts example.com
```

Good targets to try in the app or the terminal:

| Target | What you should see |
| --- | --- |
| `example.com` | Everything passes |
| `this-domain-does-not-exist-12345.com` | DNS fails everywhere, rest skipped |
| `expired.badssl.com` | TLS fails, certificate expired |
| `wrong.host.badssl.com` | TLS fails, certificate for a different domain |
| `http://github.com` | A redirect chain from HTTP to HTTPS |
| `https://httpbin.org/redirect/10` | Too many redirects |

**Simulating DNS blocking locally:** add the line `0.0.0.0 example.com` to your hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` elsewhere), flush your DNS cache (`ipconfig /flushdns` on Windows), and run `example.com`. You should get the DNS sinkhole verdict. Remove the line afterwards.

While the control server runs on the same machine as the agent, both columns see the same network, so real "blocked here, fine there" results only appear once the control server is hosted elsewhere.

## Design

SulfNet uses a neo-brutalist style, kept consistent across both themes:

- **Palette:** white base, black ink, with red `#FF3B30`, yellow `#FFD400` and teal `#00C2A8` as accents.
- **Shapes:** 3 px solid black borders, hard offset shadows with no blur, no rounded corners, a dot-grid background, and flat color fills.
- **Type:** Space Grotesk for display text, JetBrains Mono for technical and status text.
- **Dark mode:** a sun/moon toggle in the header. Your choice is saved in the browser. Accent colors stay the same, and anything on an accent fill keeps black text.
- **Motion:** every animation has a reduced-motion fallback.

## Deployment

The project currently runs locally. Planned setup:

- **Control server** on a public Node host (for example Render): root directory `backend`, build command `npm install`, start command `npm start`, with `GEMINI_API_KEY`, `GEMMA_MODEL` and `ALLOWED_ORIGIN` set to the frontend's URL. Free tiers sleep when idle, so the first request can be slow.
- **Frontend** on a static host (for example Vercel): root directory `frontend`, Vite preset, with `VITE_CONTROL_URL` set to the control server's URL.
- **Local agent** always runs on the user's own machine. Set its `ALLOWED_ORIGIN` to the deployed frontend URL. Chrome may show a prompt asking to allow access to devices on the local network, which is expected.

## Limitations

- The verdicts come from heuristics and are worded as "consistent with", not as proof of what a network operator is doing.
- The control server is one vantage point, so it can't rule out region-specific behavior elsewhere.
- Some networks block direct DNS queries to public resolvers. In that case the resolver comparison is skipped and the verdict notes it.
- Public hosting needs hardening first: blocking private and internal address ranges on the control server (including via redirects) and rate limiting. Both are on the roadmap below.

## Roadmap

- Server safety guard: reject private and internal addresses, add rate limiting.
- **Block fingerprinting:** identify how a site is blocked, such as SNI filtering (retrying the handshake with a neutral server name), TLS interception, and injected resets versus silent drops, each shown with its evidence and a confidence level.
- Multiple control locations.
- Run history and shareable reports.

## Team

Built by a team for a hackathon track that requires Google Gemma. Add team member names here.

## Credits

- Inspired by [ShutdownScout](https://github.com/somnoynadno/ShutdownScout).
- [React Bits](https://reactbits.dev): `Magnet` and `ClickSpark`.
- [GSAP](https://gsap.com) for animation.
- [Google Gemma](https://ai.google.dev/gemma) for the explanation text.
- Fonts: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono).
- Test targets from [badssl.com](https://badssl.com) and [httpbin.org](https://httpbin.org).