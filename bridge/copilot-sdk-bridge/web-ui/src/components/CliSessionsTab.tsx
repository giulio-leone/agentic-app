import { useState, useCallback, useEffect } from 'react';

interface CliSession {
  id?: string;
  sessionId?: string;
  status?: string;
  model?: string;
  createdAt?: string;
  summary?: string;
  isRemote?: boolean;
  context?: {
    cwd?: string;
    repository?: string;
    branch?: string;
  };
}

interface CliSessionsTabProps {
  client: any;
  isConnected: boolean;
}

function getId(s: CliSession): string {
  return s.id || s.sessionId || '';
}

export function CliSessionsTab({ client, isConnected }: CliSessionsTabProps) {
  const [sessions, setSessions] = useState<CliSession[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!client || !isConnected) return;
    setLoading(true);
    try {
      const result = await client.listCliSessions(filter || undefined);
      setSessions(Array.isArray(result) ? result : result?.sessions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [client, isConnected, filter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const viewMessages = async (id: string) => {
    if (!client) return;
    setSelectedId(id);
    try {
      const msgs = await client.getCliSessionMessages(id);
      setSessionMessages(Array.isArray(msgs) ? msgs : msgs?.messages ?? []);
    } catch {
      setSessionMessages([]);
    }
  };

  const resumeSession = async (id: string) => {
    if (!client) return;
    try { await client.resumeCliSession(id); } catch { /* ignore */ }
  };

  const deleteSession = async (id: string) => {
    if (!client) return;
    try {
      await client.deleteCliSession(id);
      setSessions((s) => s.filter((x) => getId(x) !== id));
      if (selectedId === id) { setSelectedId(null); setSessionMessages([]); }
    } catch { /* ignore */ }
  };

  return (
    <div className="cli-sessions-tab">
      <div className="cli-sessions-toolbar">
        <input
          type="text"
          placeholder="Filter sessions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn btn-primary" onClick={fetchSessions} disabled={!isConnected || loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="cli-sessions-list" style={{ minWidth: 280, maxWidth: 360 }}>
          {sessions.length === 0 && (
            <div className="empty-state" style={{ padding: 24 }}>
              {isConnected ? 'No CLI sessions found' : 'Connect to view sessions'}
            </div>
          )}
          {sessions.map((s) => {
            const id = getId(s);
            return (
              <div
                key={id}
                className="cli-session-item"
                onClick={() => viewMessages(id)}
                style={selectedId === id ? { borderColor: 'var(--accent)' } : {}}
              >
                <div>
                  <div className="session-id">{s.summary || id.slice(0, 16) + '…'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {s.model || s.context?.repository || 'unknown'} · {s.status || '—'}
                  </div>
                </div>
                <div className="session-actions">
                  <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); resumeSession(id); }} title="Resume">
                    ▶
                  </button>
                  <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); deleteSession(id); }} title="Delete" style={{ padding: '5px 8px' }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, borderLeft: '1px solid var(--border)' }}>
          {selectedId ? (
            <>
              <h4 style={{ fontSize: 13, color: 'var(--text-accent)', marginBottom: 8 }}>
                Messages — {selectedId.slice(0, 16)}…
              </h4>
              {sessionMessages.length === 0 ? (
                <div className="empty-state">No messages</div>
              ) : (
                sessionMessages.map((msg: any, i: number) => (
                  <div key={i} style={{
                    padding: '6px 8px',
                    marginBottom: 4,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 4,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: 8 }}>{msg.role || 'unknown'}</span>
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="empty-state">Select a session to view messages</div>
          )}
        </div>
      </div>
    </div>
  );
}
