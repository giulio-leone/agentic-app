/**
 * Copilot SDK Bridge — TCP NDJSON server that speaks ACP protocol.
 *
 * Translates ACP JSON-RPC requests from the mobile app into
 * Copilot SDK session calls, and streams Copilot responses back
 * as ACP session/update notifications.
 *
 * Usage:
 *   npx tsx server.ts [--port 3020] [--model gpt-4.1]
 *
 * Prerequisites:
 *   - GitHub Copilot CLI installed and authenticated (`copilot login`)
 *   - Node.js 18+
 */

import { createServer, type Socket } from "net";
import { CopilotClient } from "@github/copilot-sdk";

// ── Config ──

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") ?? "3020", 10);
const MODEL = process.argv.find((_, i, a) => a[i - 1] === "--model") ?? "gpt-4.1";

// ── Types ──

interface JSONRPC {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

// ── Bridge ──

let client: InstanceType<typeof CopilotClient> | null = null;
let session: Awaited<ReturnType<InstanceType<typeof CopilotClient>["createSession"]>> | null = null;

async function ensureClient(): Promise<InstanceType<typeof CopilotClient>> {
  if (!client) {
    client = new CopilotClient();
  }
  return client;
}

async function ensureSession() {
  const c = await ensureClient();
  if (!session) {
    session = await c.createSession({ model: MODEL, streaming: true });
    console.log(`[bridge] Session created with model: ${MODEL}`);
  }
  return session;
}

// ── Socket handler ──

function handleConnection(socket: Socket) {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[bridge] Client connected: ${addr}`);
  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.substring(0, idx).trim();
      buffer = buffer.substring(idx + 1);
      if (!line) continue;
      try {
        const msg: JSONRPC = JSON.parse(line);
        handleMessage(socket, msg);
      } catch {
        console.warn(`[bridge] Malformed JSON: ${line.substring(0, 100)}`);
      }
    }
  });

  socket.on("close", () => {
    console.log(`[bridge] Client disconnected: ${addr}`);
  });

  socket.on("error", (err) => {
    console.error(`[bridge] Socket error (${addr}):`, err.message);
  });
}

function send(socket: Socket, msg: JSONRPC): void {
  if (!socket.writable) return;
  socket.write(JSON.stringify(msg) + "\n");
}

function sendNotification(socket: Socket, method: string, params: Record<string, unknown>): void {
  send(socket, { jsonrpc: "2.0", method, params });
}

function sendResponse(socket: Socket, id: string | number, result: unknown): void {
  send(socket, { jsonrpc: "2.0", id, result });
}

function sendError(socket: Socket, id: string | number, code: number, message: string): void {
  send(socket, { jsonrpc: "2.0", id, error: { code, message } });
}

// ── ACP message handling ──

async function handleMessage(socket: Socket, msg: JSONRPC) {
  const { method, id, params } = msg;

  try {
    switch (method) {
      case "initialize":
        sendResponse(socket, id!, {
          agentInfo: {
            name: `Copilot SDK (${MODEL})`,
            version: "1.0.0",
            capabilities: { promptCapabilities: { image: false } },
            modes: [],
          },
        });
        break;

      case "session/new":
        // Reset session for fresh conversation
        session = null;
        await ensureSession();
        sendResponse(socket, id!, { sessionId: `copilot-${Date.now()}` });
        break;

      case "session/list":
        sendResponse(socket, id!, { sessions: [] });
        break;

      case "session/prompt":
        await handlePrompt(socket, id!, params);
        break;

      case "session/cancel":
        // Copilot SDK doesn't have explicit cancel — just ack
        sendResponse(socket, id!, { success: true });
        break;

      case "session/set_mode":
        sendResponse(socket, id!, { success: true });
        break;

      default:
        sendError(socket, id!, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[bridge] Error handling ${method}:`, message);
    if (id !== undefined) {
      sendError(socket, id, -32000, message);
    }
  }
}

async function handlePrompt(socket: Socket, id: string | number, params?: Record<string, unknown>) {
  const s = await ensureSession();
  const prompt = (params?.prompt as string) ?? (params?.message as string) ?? "";
  if (!prompt) {
    sendError(socket, id, -32602, "Missing prompt parameter");
    return;
  }

  // Send prompt response immediately (ack)
  sendResponse(socket, id, { status: "streaming" });

  // Notify start
  sendNotification(socket, "session/update", {
    update: { sessionUpdate: "agent_message_start", content: {} },
  });

  // Stream response
  try {
    // Listen for delta events
    const deltaHandler = (event: { data: { deltaContent: string } }) => {
      sendNotification(socket, "session/update", {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: event.data.deltaContent },
        },
      });
    };
    s.on("assistant.message_delta", deltaHandler);

    await s.sendAndWait({ prompt });

    s.off("assistant.message_delta", deltaHandler);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendNotification(socket, "session/update", {
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: `\n\n⚠️ Error: ${message}` },
      },
    });
  }

  // Notify end
  sendNotification(socket, "session/update", {
    update: { sessionUpdate: "agent_message_end", content: {} },
  });
}

// ── Server ──

const server = createServer(handleConnection);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Copilot SDK Bridge — ACP over TCP     ║
╠══════════════════════════════════════════╣
║  Port:  ${String(PORT).padEnd(33)}║
║  Model: ${MODEL.padEnd(33)}║
║  Protocol: NDJSON (ACP-compatible)      ║
╚══════════════════════════════════════════╝

Connect from Agentic app: tcp://localhost:${PORT}
`);
});

server.on("error", (err) => {
  console.error("[bridge] Server error:", err.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[bridge] Shutting down...");
  server.close();
  if (client) {
    await (client as any).stop?.();
  }
  process.exit(0);
});
