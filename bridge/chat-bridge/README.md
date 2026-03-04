# Agmente Chat Bridge

**CLI agents from your phone. No terminal. Just a chat.**

Runs on your machine with CLI tools installed. Connect from the Agmente app via WebSocket over Tailscale, NordVPN Meshnet, or local network.

## Architecture

```
Copilot CLI / Claude Code / Codex
     │ spawned by
Chat Bridge (this server)
     │ output parsed into
Chat Messages (assistant_chunk, tool_use, thinking...)
     │ streamed via
WebSocket (port 3030)
     │ over
Tailscale / NordVPN Meshnet / LAN
     │ to
Agmente App (React Native)
```

## Quick Start

```bash
cd bridge/chat-bridge
npm install

# Start the bridge
npm start

# With Tailscale auto-publish
npm start -- --tailscale

# With Tailscale Funnel (public access)
npm start -- --funnel

# With auth token
npm start -- --token my-secret-token
```

Or from the project root:

```bash
npm run bridge
npm run bridge:tailscale
npm run bridge:funnel
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3030` | WebSocket server port |
| `--token <t>` | — | Auth token (also `CHAT_BRIDGE_TOKEN` env) |
| `--tailscale` | off | Auto-publish via `tailscale serve` |
| `--funnel` | off | Auto-publish via `tailscale funnel` (public) |
| `--no-qr` | off | Don't print QR code |

## WebSocket Protocol

Connect: `ws://host:3030` (add `?token=xxx` if auth enabled)

### Client → Server

```json
{ "type": "create_session", "cli": "claude", "cwd": "/path", "model": "opus" }
{ "type": "message", "sessionId": "abc123", "content": "Fix the login bug" }
{ "type": "stop", "sessionId": "abc123" }
{ "type": "destroy_session", "sessionId": "abc123" }
{ "type": "list_sessions" }
{ "type": "resume_session", "sessionId": "abc123" }
{ "type": "ping" }
{ "type": "get_status" }
```

### Server → Client

```json
{ "type": "session_created", "sessionId": "abc123", "cli": "claude", "cwd": "/path" }
{ "type": "assistant_start", "sessionId": "abc123", "messageId": "msg1" }
{ "type": "assistant_chunk", "sessionId": "abc123", "messageId": "msg1", "text": "I'll fix..." }
{ "type": "tool_use", "sessionId": "abc123", "messageId": "msg1", "toolName": "file_edit", "input": {...} }
{ "type": "tool_result", "sessionId": "abc123", "messageId": "msg1", "toolName": "file_edit", "output": "..." }
{ "type": "thinking", "sessionId": "abc123", "messageId": "msg1", "text": "Let me analyze..." }
{ "type": "assistant_end", "sessionId": "abc123", "messageId": "msg1", "usage": {...} }
{ "type": "session_list", "sessions": [...] }
{ "type": "status", "network": {...}, "sessions": [...], "uptime": 123 }
{ "type": "error", "message": "..." }
{ "type": "pong", "timestamp": 1234567890 }
```

## HTTP Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Health check + network info |
| `GET /qr` | QR code SVG for mobile pairing |
| `GET /status` | Full status (network + sessions) |

## Supported CLIs

| CLI | Structured Output | Status |
|-----|-------------------|--------|
| Claude Code (`claude`) | ✅ stream-json | Full support |
| Copilot CLI (`copilot`) | ❌ raw text | Basic support |
| Codex (`codex`) | ❌ raw text | Basic support |

## Networking

### Tailscale
Auto-detected. Use `--tailscale` to publish to your tailnet with HTTPS.
Use `--funnel` for public access (no Tailscale app needed on phone).

### NordVPN Meshnet
Auto-detected. The bridge discovers your meshnet IP and hostname.
Connect from the app using the meshnet address.

### Local Network
Always available. Connect via LAN IP shown in the startup banner.
