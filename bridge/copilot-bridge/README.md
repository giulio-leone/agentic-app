# Copilot SDK Bridge

ACP-compatible TCP bridge that exposes GitHub Copilot (via `@github/copilot-sdk`) as a standard ACP server.

## Prerequisites

- **Node.js 18+**
- **GitHub Copilot CLI** installed and authenticated:
  ```bash
  npm install -g @anthropic/copilot
  copilot login
  ```

## Quick Start

```bash
cd bridge/copilot-bridge
npm install
npm start
```

Default: listens on `tcp://0.0.0.0:3020` with model `gpt-4.1`.

## Options

```bash
npx tsx server.ts --port 3020 --model gpt-4.1
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3020 | TCP port to listen on |
| `--model` | gpt-4.1 | Copilot model to use |

## Connect from Agentic

In the app, use the **Copilot SDK** preset in QuickSetup, or add manually:
- Scheme: `tcp`
- Host: `localhost:3020`

## How it Works

1. App connects via TCP with NDJSON (newline-delimited JSON-RPC)
2. Bridge translates ACP methods (`initialize`, `session/prompt`, etc.) to Copilot SDK calls
3. Copilot SDK streams responses via `assistant.message_delta` events
4. Bridge emits `session/update` ACP notifications back to the app
