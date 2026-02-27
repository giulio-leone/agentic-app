import { useState, useEffect, useRef } from 'react';
import { useBridgeClient } from './services/useBridgeClient';
import { ChatTab } from './components/ChatTab';
import { StatusTab } from './components/StatusTab';
import { ConsoleTab } from './components/ConsoleTab';
import { CliSessionsTab } from './components/CliSessionsTab';

type Tab = 'chat' | 'cli' | 'status' | 'console';

const TAB_ICONS: Record<Tab, string> = {
  chat: '💬',
  cli: '📋',
  status: '📡',
  console: '🖥',
};

const TAB_LABELS: Record<Tab, string> = {
  chat: 'Chat',
  cli: 'CLI Sessions',
  status: 'Status',
  console: 'Console',
};

/** Derive the default WS URL from the page's host so it works on remote devices too. */
function getDefaultWsUrl(): string {
  const host = window.location.hostname;
  const wsPort = parseInt(window.location.port || '3031', 10) - 1; // HTTP is port+1 of WS
  return `ws://${host}:${wsPort}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [url, setUrl] = useState(() => localStorage.getItem('bridge-url') || getDefaultWsUrl());
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const autoConnectAttempted = useRef(false);
  const bridge = useBridgeClient();
  const { client, connectionState, consoleLog, connect, disconnect } = bridge;

  const isConnected = connectionState === 'connected' || connectionState === 'authenticated';
  const statusClass = isConnected ? 'connected' : connectionState === 'connecting' ? 'connecting' : 'disconnected';
  const savedUrl = localStorage.getItem('bridge-url');

  // Auto-connect on mount if there's a saved URL
  useEffect(() => {
    if (!autoConnectAttempted.current && savedUrl && !isConnected) {
      autoConnectAttempted.current = true;
      const timer = setTimeout(() => {
        setIsAutoConnecting(true);
        connect(savedUrl);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Clear auto-connecting indicator once connected
  useEffect(() => {
    if (isConnected && isAutoConnecting) {
      setIsAutoConnecting(false);
    }
  }, [isConnected, isAutoConnecting]);

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      localStorage.setItem('bridge-url', url);
      connect(url);
    }
  };

  return (
    <div className="app">
      <div className="connection-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://host:port"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          {savedUrl && <span title="URL saved to localStorage" style={{ fontSize: '12px', color: '#666' }}>💾</span>}
        </div>
        <button className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`} onClick={handleConnect}>
          {isAutoConnecting ? 'Auto-connecting...' : isConnected ? 'Disconnect' : 'Connect'}
        </button>
        <span className={`status-dot ${statusClass}`} />
        <span className="status-text">{isAutoConnecting ? 'auto-connecting' : connectionState}</span>
      </div>

      <div className="main-area">
        <nav className="tab-bar">
          {(Object.keys(TAB_ICONS) as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              title={TAB_LABELS[tab]}
            >
              <span className="tab-icon">{TAB_ICONS[tab]}</span>
              <span className="tab-label">{TAB_LABELS[tab]}</span>
            </button>
          ))}
        </nav>

        <div className="tab-content">
          {activeTab === 'chat' && <ChatTab client={client} isConnected={isConnected} />}
          {activeTab === 'cli' && <CliSessionsTab client={client} isConnected={isConnected} />}
          {activeTab === 'status' && <StatusTab client={client} connectionState={connectionState} />}
          {activeTab === 'console' && <ConsoleTab entries={consoleLog} />}
        </div>
      </div>
    </div>
  );
}
