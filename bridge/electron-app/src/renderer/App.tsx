import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from './components/StatusBar';
import { ProviderConfig } from './components/ProviderConfig';
import { ServerConfig } from './components/ServerConfig';
import { LogViewer } from './components/LogViewer';

interface BridgeConfig {
  port: number;
  cwd: string;
  copilot: boolean;
  codex: boolean;
  model: string;
  codexModel: string;
  codexPath: string;
}

type BridgeStatus = 'stopped' | 'starting' | 'running' | 'error';

export function App() {
  const [status, setStatus] = useState<BridgeStatus>('stopped');
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [clients, setClients] = useState(0);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'logs'>('config');

  // Load initial state
  useEffect(() => {
    const api = window.electronAPI;
    api.getConfig().then(setConfig);
    api.getStatus().then((s) => setStatus(s as BridgeStatus));
    api.getLogs().then(setLogs);
    api.getClients().then(setClients);
    api.getAutoLaunch().then(setAutoLaunch);

    const unsub1 = api.onStatusChange((s) => setStatus(s as BridgeStatus));
    const unsub2 = api.onLog((line) => setLogs((prev) => [...prev.slice(-499), line]));
    const unsub3 = api.onAction(async (action) => {
      if (action === 'start') await api.startBridge();
      else if (action === 'stop') await api.stopBridge();
      else if (action === 'restart') await api.restartBridge();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const updateConfig = useCallback(async (patch: Partial<BridgeConfig>) => {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    await window.electronAPI.setConfig(next);
  }, [config]);

  const handleStart = useCallback(async () => {
    if (config) await window.electronAPI.setConfig(config);
    await window.electronAPI.startBridge();
  }, [config]);

  const handleStop = useCallback(() => window.electronAPI.stopBridge(), []);
  const handleRestart = useCallback(() => window.electronAPI.restartBridge(), []);

  const handleAutoLaunch = useCallback(async (enabled: boolean) => {
    setAutoLaunch(enabled);
    await window.electronAPI.setAutoLaunch(enabled);
  }, []);

  if (!config) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col h-screen">
      {/* Draggable title bar area */}
      <div className="h-8 flex-shrink-0" />

      <StatusBar
        status={status}
        clients={clients}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
      />

      {/* Tab switcher */}
      <div className="flex border-b border-gray-700 px-4">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'config' ? 'text-accent border-b-2 border-accent' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Config
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'logs' ? 'text-accent border-b-2 border-accent' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Logs
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'config' ? (
          <div className="space-y-4">
            <ServerConfig config={config} onUpdate={updateConfig} />
            <ProviderConfig config={config} onUpdate={updateConfig} />

            {/* Auto-launch toggle */}
            <div className="bg-surface-light rounded-lg p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">🚀 Start on login</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-accent"
                  checked={autoLaunch}
                  onChange={(e) => handleAutoLaunch(e.target.checked)}
                />
              </label>
            </div>
          </div>
        ) : (
          <LogViewer logs={logs} onClear={() => {
            setLogs([]);
            window.electronAPI.clearLogs();
          }} />
        )}
      </div>
    </div>
  );
}
