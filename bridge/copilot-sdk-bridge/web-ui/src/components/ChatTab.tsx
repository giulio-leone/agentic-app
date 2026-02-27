import { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallCard } from './ToolCallCard';

interface MessagePart {
  type: 'text' | 'reasoning' | 'toolCall' | 'toolResult';
  content: string;
  toolName?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  timestamp: number;
}

interface Model {
  id: string;
  name?: string;
  capabilities?: string[];
}

interface ChatTabProps {
  client: any;
  isConnected: boolean;
}

export function ChatTab({ client, isConnected }: ChatTabProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [cwd, setCwd] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref to accumulate assistant parts during streaming
  const assistantPartsRef = useRef<MessagePart[]>([]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const fetchModels = useCallback(async () => {
    if (!client || !isConnected) return;
    try {
      const result = await client.listModels();
      setModels(Array.isArray(result) ? result : result?.models ?? []);
    } catch {
      /* ignore */
    }
  }, [client, isConnected]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const createSession = async () => {
    if (!client || !selectedModel) return;
    try {
      const result = await client.newSession(selectedModel, cwd || undefined);
      const id = typeof result === 'string' ? result : result?.sessionId;
      setSessionId(id);
      setMessages([{ role: 'system', parts: [{ type: 'text', content: `Session created: ${id}` }], timestamp: Date.now() }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'system', parts: [{ type: 'text', content: `Error: ${err.message}` }], timestamp: Date.now() }]);
    }
  };

  const destroySession = async () => {
    if (!client || !sessionId) return;
    try {
      await client.destroySession(sessionId);
    } catch { /* ignore */ }
    setSessionId(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || !client || !sessionId || streaming) return;

    setInput('');
    setMessages((m) => [...m, { role: 'user', parts: [{ type: 'text', content: prompt }], timestamp: Date.now() }]);
    setStreaming(true);

    // Initialize accumulator for this assistant message
    assistantPartsRef.current = [];

    const appendPart = (part: MessagePart) => {
      assistantPartsRef.current = [...assistantPartsRef.current, part];
      const currentParts = assistantPartsRef.current;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', parts: currentParts, timestamp: last.timestamp }];
        }
        return [...prev, { role: 'assistant', parts: currentParts, timestamp: Date.now() }];
      });
    };

    const updateLastTextPart = (text: string) => {
      const parts = assistantPartsRef.current;
      const lastPart = parts[parts.length - 1];
      if (lastPart?.type === 'text') {
        assistantPartsRef.current = [...parts.slice(0, -1), { ...lastPart, content: lastPart.content + text }];
      } else {
        assistantPartsRef.current = [...parts, { type: 'text', content: text }];
      }
      const currentParts = assistantPartsRef.current;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', parts: currentParts, timestamp: last.timestamp }];
        }
        return [...prev, { role: 'assistant', parts: currentParts, timestamp: Date.now() }];
      });
    };

    try {
      await client.promptSession(sessionId, prompt, {
        onContent: (text: string) => updateLastTextPart(text),
        onReasoning: (text: string) => appendPart({ type: 'reasoning', content: text }),
        onToolCall: (name: string, args: string) => appendPart({ type: 'toolCall', content: args, toolName: name }),
        onToolResult: (result: string) => appendPart({ type: 'toolResult', content: result }),
        onComplete: () => setStreaming(false),
        onError: (err: string) => {
          appendPart({ type: 'text', content: `\n⚠️ Error: ${err}` });
          setStreaming(false);
        },
      });
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'system', parts: [{ type: 'text', content: `Error: ${err.message}` }], timestamp: Date.now() }]);
      setStreaming(false);
    }
  };

  const cancelStream = async () => {
    if (client && sessionId) {
      try { await client.cancelSession(sessionId); } catch { /* ignore */ }
    }
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-tab">
      <div className="chat-toolbar">
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={!!sessionId}>
          <option value="">Select model…</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name || m.id}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Working directory"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          disabled={!!sessionId}
        />
        {!sessionId ? (
          <button className="btn btn-primary" onClick={createSession} disabled={!isConnected || !selectedModel}>
            New Session
          </button>
        ) : (
          <button className="btn btn-danger" onClick={destroySession}>
            End Session
          </button>
        )}
      </div>

      {sessionId && (
        <div className="session-info">
          <span>Session: <code>{sessionId.slice(0, 12)}…</code></span>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            {isConnected ? 'Create a session to start chatting' : 'Connect to the bridge first'}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionId ? 'Type a message…' : 'Create a session first'}
          disabled={!sessionId || streaming}
          rows={1}
        />
        {streaming ? (
          <button className="btn btn-danger" onClick={cancelStream}>Cancel</button>
        ) : (
          <button className="btn btn-primary" onClick={sendMessage} disabled={!sessionId || !input.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

const roleAvatar: Record<string, string> = { user: '👤', assistant: '🤖', system: '⚙️' };

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`message ${message.role}`}>
      <span className="avatar">{roleAvatar[message.role] || '💬'}</span>
      <div className="msg-body">
        {message.parts.map((part, i) => (
          <MessagePartView key={i} part={part} role={message.role} />
        ))}
        <div className="msg-timestamp">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
}

function MessagePartView({ part, role }: { part: MessagePart; role: string }) {
  const [collapsed, setCollapsed] = useState(true);

  switch (part.type) {
    case 'text':
      return role === 'user'
        ? <span>{part.content}</span>
        : <MarkdownRenderer content={part.content} />;
    case 'reasoning':
      return (
        <div className={`reasoning-block ${collapsed ? 'collapsed' : ''}`} onClick={() => setCollapsed(!collapsed)}>
          <div className="reasoning-header">
            💭 {collapsed ? '▶' : '▼'} Reasoning
          </div>
          <div className="reasoning-content">
            <MarkdownRenderer content={part.content} />
          </div>
        </div>
      );
    case 'toolCall':
      return <ToolCallCard name={part.toolName || 'unknown'} args={part.content} />;
    case 'toolResult':
      return <ToolCallCard name="result" args={part.content} status="done" />;
    default:
      return <span>{part.content}</span>;
  }
}
