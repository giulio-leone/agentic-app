import { useState } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [url, setUrl] = useState('ws://localhost:3030');
  const bridge = useBridgeClient();
  const { client, connectionState, consoleLog, connect, disconnect } = bridge;

  const isConnected = connectionState === 'connected' || connectionState === 'authenticated';
  const statusClass = isConnected ? 'connected' : connectionState === 'connecting' ? 'connecting' : 'disconnected';

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(url);
    }
  };

  return (
    <div className="app">
      <div className="connection-bar">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://localhost:3030"
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
        />
        <button className={`btn ${isConnected ? 'btn-danger' : 'btn-primary'}`} onClick={handleConnect}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
        <span className={`status-dot ${statusClass}`} />
        <span className="status-text">{connectionState}</span>
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
