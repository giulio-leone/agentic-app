/**
 * EventMapper — translates provider-specific events into ACP notifications.
 *
 * Creates StreamCallbacks that pipe events to a Socket as ACP `session/update`
 * notifications. Providers call these callbacks; the mapper formats and sends.
 */

import type { Socket } from 'net';
import type { AgentEvent, StreamCallbacks } from './types.js';

function send(socket: Socket, msg: Record<string, unknown>): void {
  if (!socket.writable) return;
  socket.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
}

/**
 * Creates StreamCallbacks wired to an ACP socket.
 * Every provider event is translated to the correct `session/update` notification.
 */
export function createStreamCallbacks(socket: Socket): StreamCallbacks {
  return {
    onMessageStart() {
      send(socket, {
        method: 'session/update',
        params: {
          update: { sessionUpdate: 'agent_message_start', content: {} },
        },
      });
    },

    onMessageChunk(text: string) {
      send(socket, {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text },
          },
        },
      });
    },

    onMessageEnd() {
      send(socket, {
        method: 'session/update',
        params: {
          update: { sessionUpdate: 'agent_message_end', content: {} },
        },
      });
    },

    onAgentEvent(event: AgentEvent) {
      send(socket, {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_event',
            content: { type: 'event', event },
          },
        },
      });
    },

    onError(error: string) {
      send(socket, {
        method: 'session/update',
        params: {
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `\n\n⚠️ Error: ${error}` },
          },
        },
      });
    },
  };
}
