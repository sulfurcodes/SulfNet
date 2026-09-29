# SulfNet

**Why can't I reach it?** Paste a URL and SulfNet checks DNS, TCP, TLS and HTTP from your own network and from an outside control server, compares the two, and tells you where and why it breaks.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Google Gemma](https://img.shields.io/badge/Google_Gemma-4285F4?style=for-the-badge&logo=google&logoColor=white)

## How it works

1. The browser asks the **local agent** (`127.0.0.1:8787`) to run the checks from your network.
2. The browser sends that report to the **control server** (`:8788`), which runs the same checks from its own network.
3. A rule-based engine compares both reports and picks a verdict (DNS blocked, TCP blocked, TLS problem, site down for everyone, and so on).
4. **Google Gemma** turns the verdict into a short plain-English explanation. If Gemma is unavailable, the rule-based verdict still shows.

## Project structure

```
SulfNet/
├─ frontend/        React + Vite + TypeScript (Home and Diagnosis screens)
└─ backend/
   └─ src/
      ├─ agent.ts       local agent
      ├─ server.ts      control server (/check, /diagnose)
      ├─ diagnose.ts    rule-based verdict
      ├─ gemma.ts       Gemma explanation
      └─ checks/        dns, tcp, tls, http
```

## Run it locally

Requires Node.js 18 or newer.

```bash
# backend
cd backend
npm install
cp .env.example .env     # then add your GEMINI_API_KEY
npm run agent            # terminal 1
npm run server           # terminal 2

# frontend (terminal 3)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Environment variables (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio key for the Gemma explanation |
| `GEMMA_MODEL` | Gemma model ID (default `gemma-3-27b-it`) |
| `AGENT_PORT` | Local agent port (default `8787`) |
| `SERVER_PORT` | Control server port (default `8788`) |
| `ALLOWED_ORIGIN` | Frontend origin allowed by CORS (default `http://localhost:5173`) |