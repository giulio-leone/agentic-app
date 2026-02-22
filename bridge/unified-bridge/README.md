# Agentic Unified Bridge

Multi-provider ACP bridge that translates between the Agentic app's ACP protocol
and native agent protocols (Copilot SDK, Codex app-server).

## Architecture

```
App ←ACP (TCP NDJSON)→ [Unified Bridge :3020]
                         ├── ProviderRegistry
                         ├── CopilotProvider  (@github/copilot-sdk)
                         ├── CodexProvider    (codex app-server stdio)
                         └── EventMapper      (agent events → ACP)
```

### Design Principles

- **SOLID**: Each provider implements `ProviderAdapter` interface (ISP)
- **KISS**: Minimal protocol translation, no over-abstraction
- **DRY**: Shared `StreamCallbacks` + `EventMapper` for all providers

## Quick Start

```bash
# Copilot only (default)
npx tsx src/index.ts

# Both providers
npx tsx src/index.ts --copilot --codex

# Codex only
npx tsx src/index.ts --no-copilot --codex

# Custom port + model
npx tsx src/index.ts --port 3030 --model claude-sonnet-4 --codex --codex-model o4-mini
```

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | 3020 | TCP listen port |
| `--cwd <path>` | `process.cwd()` | Working directory |
| `--copilot` | enabled | Enable Copilot provider |
| `--no-copilot` | - | Disable Copilot provider |
| `--codex` | disabled | Enable Codex provider |
| `--model <name>` | gpt-4.1 | Default Copilot model |
| `--codex-model <name>` | codex-mini-latest | Default Codex model |
| `--cli-path <path>` | auto | Path to Copilot CLI binary |
| `--codex-path <path>` | codex | Path to codex binary |
| `--approval-policy` | unless-allow-listed | Codex approval policy |
| `--sandbox` | workspaceWrite | Codex sandbox mode |

## Providers

### Copilot SDK
- Wraps `@github/copilot-sdk` which spawns Copilot CLI as child process
- Supports: streaming, cancel, multi-session, filesystem tools, ask_user
- Session IDs: `copilot-{n}-{timestamp}`

### Codex App Server
- Spawns `codex app-server --listen stdio://` as child process
- Translates ACP session model → Codex thread/turn model
- Streams **agent events** (terminal commands, file edits, reasoning)
- Session IDs: `codex-{n}-{timestamp}`

## Agent Events

The bridge maps provider-specific events to structured ACP `session/update` notifications:

| Event Kind | Description | Source |
|------------|-------------|--------|
| `terminal_command` | Agent executing a shell command | Codex |
| `terminal_output` | Command output + exit code | Codex |
| `file_edit` | Agent editing a file | Codex |
| `reasoning` | Agent's thinking/reasoning | Codex |
| `tool_call` | Agent calling a tool | Both |
| `tool_result` | Tool execution result | Both |

## Protocol

The bridge speaks ACP (Agent Communication Protocol) over TCP NDJSON:

### Methods

| ACP Method | Description |
|-----------|-------------|
| `initialize` | Returns agent profile with all models from all providers |
| `models/list` | Aggregated model list across providers |
| `session/new` | Creates session on specified/auto-detected provider |
| `session/list` | Lists sessions across all providers |
| `session/prompt` | Sends prompt, streams response + agent events |
| `session/cancel` | Cancels active turn/prompt |
| `session/destroy` | Destroys session |
| `tool/ask_user_response` | Resolves pending ask_user (Copilot) |

### Provider Auto-Detection

When `session/new` doesn't specify a provider, the bridge auto-detects:
1. Explicit `provider` param → use that
2. Model name heuristic: `codex-*`, `o4-*` → Codex; `gpt-*`, `claude-*` → Copilot
3. Fallback → first registered provider

## Connect from App

In the Agentic app, use the "GitHub Copilot" or "Codex CLI" preset:
```
tcp://<bridge-ip>:3020
```

Both providers are accessible from the same endpoint — the bridge routes by session ID prefix.
