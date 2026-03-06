/**
 * Protocol Handler — routes incoming WebSocket messages to session manager.
 */

import type { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from './messages.js';
import type { SessionManager, MessageSink } from '../session/manager.js';
import type { NetworkManager } from '../network/manager.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('protocol');

export function createProtocolHandler(
  ws: WebSocket,
  sessions: SessionManager,
  network: NetworkManager,
) {
  // Sink sends messages to this specific WS client
  const sink: MessageSink = (msg: ServerMsg) => {
    if (ws.readyState === 1) {
      const json = JSON.stringify(msg);
      log.debug(`→ OUT [${msg.type}] ${json.length > 200 ? json.slice(0, 200) + '…' : json}`);
      ws.send(json);
    }
  };

  // Track which sessions this client is watching
  const watchingSessions = new Set<string>();

  function handle(msg: ClientMsg): void {
    log.debug(`← IN  [${msg.type}] ${JSON.stringify(msg).slice(0, 200)}`);
    switch (msg.type) {
      case 'create_session':
        handleCreateSession(msg);
        break;
      case 'message':
        handleMessage(msg);
        break;
      case 'stop':
        handleStop(msg);
        break;
      case 'destroy_session':
        handleDestroySession(msg);
        break;
      case 'list_sessions':
        handleListSessions();
        break;
      case 'resume_session':
        handleResumeSession(msg);
        break;
      case 'spawn_from_external':
        handleSpawnFromExternal(msg);
        break;
      case 'ping':
        sink({ type: 'pong', timestamp: Date.now() });
        break;
      case 'get_status':
        handleGetStatus();
        break;
      default:
        sink({ type: 'error', message: `Unknown message type: ${(msg as any).type}` });
    }
  }

  function handleCreateSession(msg: ClientMsg & { type: 'create_session' }): void {
    try {
      const session = sessions.createSession({
        cli: msg.cli,
        cwd: msg.cwd ?? process.cwd(),
        model: msg.model,
        args: msg.args,
      });
      // Register sink so this client receives messages for this session
      sessions.registerSink(session.id, sink);
      watchingSessions.add(session.id);

      sink({
        type: 'session_created',
        sessionId: session.id,
        cli: session.cli,
        cwd: session.cwd,
        model: session.model,
      });
    } catch (err) {
      sink({ type: 'error', message: `Create session failed: ${(err as Error).message}` });
    }
  }

  function handleMessage(msg: ClientMsg & { type: 'message' }): void {
    // Ensure this client is watching the session
    if (!watchingSessions.has(msg.sessionId)) {
      sessions.registerSink(msg.sessionId, sink);
      watchingSessions.add(msg.sessionId);
    }
    sessions.sendMessage(msg.sessionId, msg.content, sink);
  }

  function handleStop(msg: ClientMsg & { type: 'stop' }): void {
    sessions.stop(msg.sessionId, sink);
  }

  function handleDestroySession(msg: ClientMsg & { type: 'destroy_session' }): void {
    const ok = sessions.destroySession(msg.sessionId);
    watchingSessions.delete(msg.sessionId);
    if (ok) {
      sink({ type: 'session_destroyed', sessionId: msg.sessionId });
    } else {
      sink({ type: 'error', message: `Session not found: ${msg.sessionId}`, sessionId: msg.sessionId });
    }
  }

  function handleListSessions(): void {
    sink({ type: 'session_list', sessions: sessions.listSessions() });
  }

  function handleResumeSession(msg: ClientMsg & { type: 'resume_session' }): void {
    const session = sessions.getSession(msg.sessionId);
    if (!session) {
      sink({ type: 'error', message: `Session not found: ${msg.sessionId}`, sessionId: msg.sessionId });
      return;
    }
    sessions.registerSink(msg.sessionId, sink);
    watchingSessions.add(msg.sessionId);
    sink({ type: 'session_event', sessionId: msg.sessionId, event: 'resumed' });
  }

  function handleSpawnFromExternal(msg: ClientMsg & { type: 'spawn_from_external' }): void {
    const newSession = sessions.spawnFromExternal(msg.sessionId);
    if (!newSession) {
      sink({ type: 'error', message: `Cannot spawn from session: ${msg.sessionId}`, sessionId: msg.sessionId });
      return;
    }
    sessions.registerSink(newSession.id, sink);
    watchingSessions.add(newSession.id);
    sink({
      type: 'session_created',
      sessionId: newSession.id,
      cli: newSession.cli,
      cwd: newSession.cwd,
      model: newSession.model,
    });
  }

  function handleGetStatus(): void {
    sink({
      type: 'status',
      network: network.getInfo(),
      sessions: sessions.listSessions(),
      uptime: process.uptime(),
    });
  }

  function cleanup(): void {
    for (const sid of watchingSessions) {
      sessions.unregisterSink(sid);
    }
    watchingSessions.clear();
  }

  return { handle, cleanup };
}
