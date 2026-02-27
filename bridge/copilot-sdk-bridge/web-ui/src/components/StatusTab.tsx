import { useState, useCallback, useEffect } from 'react';

interface Model {
  id: string;
  name?: string;
  capabilities?: string[];
}

interface StatusTabProps {
  client: any;
  connectionState: string;
}

export function StatusTab({ client, connectionState }: StatusTabProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [bridgeVersion, setBridgeVersion] = useState<string>('—');
  const [authStatus, setAuthStatus] = useState<string>('—');
  const [activeSessions, setActiveSessions] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const isConnected = connectionState === 'connected';

  const fetchInfo = useCallback(async () => {
    if (!client || !isConnected) return;
    setLoading(true);
    try {
      const initResult = await client.initialize();
      if (initResult) {
        setBridgeVersion(initResult.version || initResult.bridgeVersion || '—');
        setAuthStatus(initResult.authenticated ? 'Authenticated' : initResult.authStatus || '—');
        setActiveSessions(initResult.activeSessions ?? initResult.sessions ?? 0);
      }
    } catch { /* ignore */ }
    try {
      const modelsResult = await client.listModels();
      setModels(Array.isArray(modelsResult) ? modelsResult : modelsResult?.models ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [client, isConnected]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const badgeClass = isConnected ? 'success' : connectionState === 'connecting' ? 'warning' : 'error';

  return (
    <div className="status-tab">
      <div className="status-section">
        <h3>Connection</h3>
        <div className="status-row">
          <span className="label">State</span>
          <span className={`badge ${badgeClass}`}>{connectionState}</span>
        </div>
        <div className="status-row">
          <span className="label">Bridge Version</span>
          <span className="value">{bridgeVersion}</span>
        </div>
        <div className="status-row">
          <span className="label">Auth Status</span>
          <span className="value">{authStatus}</span>
        </div>
        <div className="status-row">
          <span className="label">Active Sessions</span>
          <span className="value">{activeSessions}</span>
        </div>
      </div>

      <div className="status-section">
        <h3>Available Models</h3>
        {models.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {isConnected ? 'No models available' : 'Connect to view models'}
          </div>
        ) : (
          <div className="model-list">
            {models.map((m) => (
              <div key={m.id} className="model-item">
                <span className="model-name">{m.name || m.id}</span>
                <div className="model-caps">
                  {(m.capabilities || []).map((cap) => (
                    <span key={cap} className="badge info">{cap}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="status-section">
        <h3>Quick Actions</h3>
        <div className="status-actions">
          <button className="btn btn-primary" onClick={fetchInfo} disabled={!isConnected || loading}>
            {loading ? 'Loading…' : 'Initialize'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!isConnected || loading}
            onClick={async () => {
              if (!client) return;
              try {
                const r = await client.listModels();
                setModels(Array.isArray(r) ? r : r?.models ?? []);
              } catch { /* ignore */ }
            }}
          >
            Refresh Models
          </button>
        </div>
      </div>
    </div>
  );
}
