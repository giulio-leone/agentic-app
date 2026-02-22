# Agentic Terminal Server

WebSocket-to-PTY bridge for the embedded terminal in Agentic.

## Setup

```bash
cd bridge/terminal-server
npm install
npm start
```

## Protocol

| Direction | Message |
|-----------|---------|
| Client → Server | `{ "type": "input", "data": "ls\n" }` |
| Client → Server | `{ "type": "resize", "cols": 120, "rows": 40 }` |
| Server → Client | `{ "type": "output", "data": "..." }` |
| Server → Client | `{ "type": "exit", "code": 0 }` |

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | WebSocket listen port |
| `SHELL` | `$SHELL` or `/bin/bash` | Shell to spawn |

## Usage with Agentic

1. Start the server: `npm start`
2. Open the terminal panel in Agentic (🖥 icon in header)
3. Connect to `ws://<your-ip>:8080`
