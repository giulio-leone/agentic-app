# Copilot SDK Bridge v2

ACP-compatible TCP bridge that exposes GitHub Copilot (via `@github/copilot-sdk`) as a standard ACP server with multi-session, tool support, model listing, and real cancel.

## Architecture

```
[S25 Agentic App] ──TCP NDJSON──▶ [Bridge v2] ──JSON-RPC──▶ [Copilot CLI]
                                       │
                                  @github/copilot-sdk
                                  • CopilotClient (resilient)
                                  • SessionManager (multi)
                                  • Tools (fs + ask_user)
```

## Prerequisites

- **Node.js 18+**
- **GitHub Copilot CLI** installed and authenticated:
  ```bash
  gh auth login
  gh extension install github/gh-copilot
  ```

## Quick Start

```bash
cd bridge/copilot-bridge
npm install
npm start
```

## Options

```bash
npx tsx src/server.ts --port 3020 --model gpt-4.1 --cwd /path/to/project
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3020 | TCP port to listen on |
| `--model` | gpt-4.1 | Default Copilot model |
| `--cwd` | process.cwd() | Working directory for tools |
| `--cli-path` | auto | Custom Copilot CLI binary path |

## ACP Methods

| Method | Description |
|--------|-------------|
| `initialize` | Returns agent profile with capabilities |
| `models/list` | Lists available Copilot models |
| `session/new` | Creates a new session (optional `model` param) |
| `session/list` | Lists all active sessions |
| `session/prompt` | Sends prompt, streams response via `session/update` |
| `session/cancel` | Aborts in-flight request (`session.abort()`) |
| `session/destroy` | Destroys a specific session |
| `session/set_mode` | Acknowledged (no-op) |
| `tool/ask_user_response` | Resolves a pending `ask_user` tool call |

## Tools (exposed to Copilot)

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents (path-traversal safe) |
| `write_file` | Write file with auto mkdir (path-traversal safe) |
| `list_files` | List directory entries |
| `ask_user` | Ask user a question → forwarded to app as `tool/ask_user` notification |

## Connect from Agentic

In the app, add a server:
- **Type**: Copilot CLI
- **Scheme**: `tcp`
- **Host**: `<mac-ip>:3020`
