/**
 * terminal-server — WebSocket-to-PTY bridge for Agentic Terminal.
 *
 * Spawns a pseudo-terminal (shell) and bridges I/O over WebSocket.
 * Protocol (NDJSON over WS):
 *   Client → Server:  { type: 'input', data: string }
 *                      { type: 'resize', cols: number, rows: number }
 *   Server → Client:  { type: 'output', data: string }
 *                      { type: 'exit', code: number }
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { platform } from 'os';

const PORT = Number(process.env.PORT) || 8080;
const SHELL = platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

interface ClientMsg {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

const wss = new WebSocketServer({ port: PORT });

console.log(`🖥  Terminal server listening on ws://0.0.0.0:${PORT}`);
console.log(`   Shell: ${SHELL}`);

wss.on('connection', (ws: WebSocket) => {
  console.log('→ Client connected');

  const ptyProcess = pty.spawn(SHELL, [], {
    name: 'xterm-256color',
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
    cwd: process.env.HOME || '/',
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  });

  // PTY → Client
  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      ws.close();
    }
    console.log(`← Shell exited (code ${exitCode})`);
  });

  // Client → PTY
  ws.on('message', (raw: Buffer) => {
    try {
      const msg: ClientMsg = JSON.parse(raw.toString());
      switch (msg.type) {
        case 'input':
          if (msg.data) ptyProcess.write(msg.data);
          break;
        case 'resize':
          if (msg.cols && msg.rows) ptyProcess.resize(msg.cols, msg.rows);
          break;
      }
    } catch {
      console.warn('Invalid message from client');
    }
  });

  ws.on('close', () => {
    console.log('← Client disconnected');
    ptyProcess.kill();
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
    ptyProcess.kill();
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  process.exit(0);
});
