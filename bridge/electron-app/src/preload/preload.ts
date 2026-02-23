import { contextBridge, ipcRenderer } from 'electron';

interface BridgeConfig {
  port: number;
  cwd: string;
  copilot: boolean;
  codex: boolean;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | '';
  codexModel: string;
  codexPath: string;
}

export interface ElectronAPI {
  getConfig(): Promise<BridgeConfig>;
  setConfig(config: BridgeConfig): Promise<boolean>;
  startBridge(): Promise<boolean>;
  stopBridge(): Promise<boolean>;
  restartBridge(): Promise<boolean>;
  getStatus(): Promise<string>;
  getLogs(): Promise<string[]>;
  clearLogs(): Promise<boolean>;
  getClients(): Promise<number>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  pickDirectory(): Promise<string | null>;
  onStatusChange(cb: (status: string) => void): () => void;
  onLog(cb: (line: string) => void): () => void;
  onAction(cb: (action: string) => void): () => void;
}

const api: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('bridge:getConfig'),
  setConfig: (c) => ipcRenderer.invoke('bridge:setConfig', c),
  startBridge: () => ipcRenderer.invoke('bridge:start'),
  stopBridge: () => ipcRenderer.invoke('bridge:stop'),
  restartBridge: () => ipcRenderer.invoke('bridge:restart'),
  getStatus: () => ipcRenderer.invoke('bridge:getStatus'),
  getLogs: () => ipcRenderer.invoke('bridge:getLogs'),
  clearLogs: () => ipcRenderer.invoke('bridge:clearLogs'),
  getClients: () => ipcRenderer.invoke('bridge:getClients'),
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (e) => ipcRenderer.invoke('app:setAutoLaunch', e),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  onStatusChange: (cb) => {
    const handler = (_: unknown, s: string) => cb(s);
    ipcRenderer.on('bridge:status', handler);
    return () => ipcRenderer.removeListener('bridge:status', handler);
  },
  onLog: (cb) => {
    const handler = (_: unknown, line: string) => cb(line);
    ipcRenderer.on('bridge:log', handler);
    return () => ipcRenderer.removeListener('bridge:log', handler);
  },
  onAction: (cb) => {
    const handler = (_: unknown, action: string) => cb(action);
    ipcRenderer.on('bridge:action', handler);
    return () => ipcRenderer.removeListener('bridge:action', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
