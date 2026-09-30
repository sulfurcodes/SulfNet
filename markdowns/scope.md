# SulfNet — Project Scope

## 1. Project Overview

SulfNet is a network diagnostics tool built to answer a simple question:

> **Why can't I reach this website?**

Instead of treating a failed website connection as one generic error, SulfNet breaks the connection into stages and compares results from two different network locations:

1. **Local Probe** — runs from the user's own machine and network.
2. **Control Probe** — runs from an external server.

The results are compared by a rule-based diagnosis engine to determine where the failure occurs and what the available evidence suggests.

Google Gemma is used only to explain the resulting diagnosis in plain language. It does not make the underlying diagnosis.

---

## 2. Current Scope

The current MVP includes a complete local end-to-end diagnostic flow.

### Core connection checks

Each probe performs the following stages in order:

```text
DNS → TCP → TLS → HTTP
```

### DNS diagnostics

SulfNet performs:

- System DNS lookup using the machine's configured resolver.
- Direct DNS queries to Cloudflare (`1.1.1.1`).
- Direct DNS queries to Google (`8.8.8.8`).
- Comparison of system DNS results with public resolver results.
- Detection of differing DNS answers.
- Detection of non-routable placeholder answers such as `0.0.0.0`.
- Detection of cases where the local resolver fails while public DNS succeeds.
- Detection of cases where direct access to public resolvers also fails.

### TCP diagnostics

SulfNet checks whether a TCP connection can be established to the resolved IP and target port.

### TLS diagnostics

For HTTPS targets, SulfNet performs a TLS handshake and records information including:

- negotiated TLS protocol
- certificate expiry
- certificate issuer
- TLS authorization errors

### HTTP diagnostics

The final stage performs an HTTP request and records:

- HTTP status code
- request latency
- redirect location when available

### Failure sequencing

Checks are intentionally sequential.

If DNS fails, TCP/TLS/HTTP are skipped.

If TCP fails, TLS/HTTP are skipped.

If TLS fails, HTTP is skipped.

This prevents later stages from producing misleading results when an earlier dependency has already failed.

---

## 3. Local Agent

The local probe runs through a Node.js/Express agent bound to:

```text
127.0.0.1:8787
```

The agent:

- accepts a target URL
- performs the complete local diagnostic
- returns the structured report
- is intentionally kept local rather than exposed as a public server

Endpoint:

```text
POST /check
```

---

## 4. Control Server

The control server runs the same diagnostic engine from an external network environment.

Responsibilities include:

- running the control probe
- receiving the local probe report
- running the comparison engine
- generating the final diagnosis
- calling the hosted Gemma API
- returning the complete diagnosis response

Endpoints:

```text
POST /check
POST /diagnose
```

---

## 5. Diagnosis Engine

The diagnosis engine is deterministic and rule-based.

The AI layer is not responsible for deciding whether a website is reachable or whether a problem appears local.

The engine evaluates:

- local failures
- control failures
- failed stages
- DNS answer differences
- public resolver results
- non-routable DNS answers
- HTTP status differences

### Current diagnosis categories

SulfNet can identify or describe cases including:

```text
REACHABLE
LOCAL_DNS_FAIL
LOCAL_DNS_RESOLVER_FAIL
LOCAL_DNS_SINKHOLE
LOCAL_TCP_FAIL
LOCAL_TLS_FAIL
LOCAL_HTTP_FAIL
CONTROL_ONLY_FAILURE
DOMAIN_NOT_FOUND
HTTP_ERROR_EVERYWHERE
DOWN_EVERYWHERE_<STAGE>
DIFFERENT_STAGES
```

The diagnosis language intentionally avoids claiming that blocking, censorship, or interference has been conclusively proven.

Instead, SulfNet reports what the observed evidence supports, using terms such as:

- possible
- likely
- appears
- may indicate

---

## 6. DNS Anomaly Detection

DNS diagnostics are an important part of SulfNet.

A system resolver may return an answer that differs from public DNS because of:

- normal CDN or geographic routing
- local DNS configuration
- router behavior
- filtering
- DNS manipulation
- hosts-file entries
- other network-level behavior

SulfNet therefore treats DNS differences as evidence rather than automatically labeling them as malicious behavior.

### DNS sinkhole detection

A particularly useful case is when the local system resolver returns a non-routable address such as:

```text
0.0.0.0
127.x.x.x
::
::1
```

while public resolvers return a real address.

This can indicate that the hostname is being redirected to a dead end by a local DNS mechanism, content filter, router, ISP, or hosts file.

The application reports this as a possible DNS sinkhole rather than definitive proof of the exact source.

---

## 7. Gemma Integration

Gemma is used as an explanation layer after the rule-based diagnosis has already been calculated.

Flow:

```text
Probe Results
      ↓
Rule-Based Diagnosis
      ↓
Compact Diagnostic Context
      ↓
Hosted Gemma API
      ↓
Plain-English Explanation
```

The model receives:

- target hostname
- rule-based verdict
- diagnostic summary
- local check results
- control check results
- public resolver information

The model is instructed to:

- use only the supplied evidence
- avoid inventing causes
- explain the result in simple language
- provide practical next steps

The API key remains on the control server.

### Fallback behavior

Gemma is not required for the core diagnostic to function.

If the API:

- is unavailable
- times out
- returns an error
- returns empty text

SulfNet falls back to the rule-based explanation.

---

## 8. Frontend Scope

The frontend currently consists of two screens.

### Home

The Home screen provides:

- URL input
- Run Diagnostic button
- loading state
- rotating progress messages
- local/control connectivity errors
- completion state
- View Diagnosis action

### Diagnosis

The Diagnosis screen provides:

- target hostname
- final verdict
- diagnosis summary
- optional diagnostic notes
- Gemma explanation
- local vs control comparison table
- per-stage status
- latency information
- error codes
- relevant DNS/TLS/HTTP details
- Run another action

The interface uses a deliberately simple neo-brutalist visual style with:

- strong borders
- high contrast
- large typography
- yellow/teal/red state colors
- compact technical metadata

---

## 9. Error Handling

There is a distinction between a **probe infrastructure failure** and a **target-site failure**.

### Infrastructure failures

Examples:

- local agent unavailable
- control server unavailable
- frontend unable to reach either service
- invalid request

These stop the diagnostic flow and return the user to an actionable error state.

### Target-site failures

Examples:

- DNS failure
- TCP timeout
- TLS handshake failure
- HTTP error

These are not treated as application errors.

They are the actual diagnostic result and continue to the Diagnosis screen.

---

## 10. Testing Scope

The backend includes test cases for multiple diagnosis scenarios, including:

- successful connectivity
- local DNS failure
- control-only failure
- domain not found
- TCP failure
- HTTP errors
- different failure stages
- public DNS resolver comparisons
- DNS sinkhole detection

TypeScript type checking is also part of the development workflow.

---

## 11. Architecture

Current architecture:

```text
┌────────────────────┐
│    React Frontend  │
│   Vite + TypeScript│
└─────────┬──────────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
┌─────────┐  ┌───────────────┐
│  Local  │  │    Control    │
│  Agent  │  │    Server     │
│  :8787  │  │     :8788     │
└────┬────┘  └───────┬───────┘
     │                │
     ▼                ▼
 Your network     External network
     │                │
     └───────┬────────┘
             ▼
      Diagnosis Engine
             │
             ▼
        Gemma API
             │
             ▼
       Diagnosis UI
```

---

## 12. Technology Scope

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express
- TypeScript

### AI

- Google GenAI SDK
- Hosted Gemma API

### Networking

- Node DNS APIs
- Node TCP sockets
- Node TLS
- Fetch / HTTP

No database is currently required for the MVP.

---

## 13. Deliberately Out of Scope

The following are not part of the current core project:

```text
❌ VPN integration
❌ Proxy integration
❌ Browser extension
❌ Mobile application
❌ Global censorship map
❌ Packet capture
❌ BGP analysis
❌ Full traceroute implementation
❌ User accounts
❌ Authentication
❌ RBAC
❌ PostgreSQL
❌ Redis
❌ Kafka
❌ Kubernetes
❌ Large-scale URL databases
❌ Distributed scanning infrastructure
❌ Scan history
❌ Multi-screen dashboard
❌ Next.js / SSR
❌ Flutter
❌ Self-hosted Gemma / Ollama
```

These features may be considered in a future version but are intentionally outside the current MVP.

---

## 14. Potential Future Features

The following are possible extensions after the current implementation is stable:

### Diagnostic improvements

- More detailed per-stage diagnostics
- Additional DNS record types
- IPv6 diagnostics
- More public DNS resolvers
- Better DNS answer comparison
- Certificate chain information
- More HTTP metadata

### Network analysis

- Traceroute-style analysis
- Multiple external control locations
- Geographic comparison
- Latency comparison across locations
- More advanced network-path diagnostics

### User experience

- More detailed live progress
- Visual connection pipeline
- Copy/share diagnostic results
- Export diagnostic reports
- Demo mode with controlled test cases
- More detailed remediation guidance

These features are optional and should not replace the stability of the existing diagnostic flow.

---

## 15. Scope Principle

SulfNet should remain focused on one problem:

> **Determine where a website connection fails, compare the result with an external network, and explain what the evidence suggests.**

New features should directly improve one of those three goals.

Features that add technology without improving the diagnostic capability should remain outside the project scope unless there is a clear reason to introduce them.

---

## 16. Current Development State

The core MVP currently works end-to-end in local development.

Completed:

```text
[✓] Local probe
[✓] Control probe
[✓] DNS diagnostics
[✓] Public DNS resolver comparison
[✓] DNS anomaly detection
[✓] TCP diagnostics
[✓] TLS diagnostics
[✓] HTTP diagnostics
[✓] Rule-based diagnosis engine
[✓] Multiple diagnosis scenarios
[✓] Hosted Gemma explanation
[✓] Gemma fallback
[✓] React frontend
[✓] Home screen
[✓] Diagnosis screen
[✓] Local vs control results table
[✓] Loading states
[✓] Error handling
[✓] Backend typecheck
[✓] Diagnostic test cases
```

Deployment, additional features, and further polish remain separate from the already-working local MVP.