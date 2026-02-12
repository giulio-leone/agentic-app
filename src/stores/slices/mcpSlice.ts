import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import { SessionStorage } from '../../storage/SessionStorage';
import { MCPManager } from '../../mcp/MCPManager';
import type { MCPServerConfig, MCPServerStatus } from '../../mcp/types';

export type MCPSlice = Pick<AppState, 'mcpServers' | 'mcpStatuses'>
  & Pick<AppActions, 'loadMCPServers' | 'addMCPServer' | 'removeMCPServer' | 'connectMCPServer' | 'disconnectMCPServer' | 'refreshMCPStatuses'>;

export const createMCPSlice: StateCreator<AppState & AppActions, [], [], MCPSlice> = (set, get) => ({
  // State
  mcpServers: [],
  mcpStatuses: [],

  // Actions

  loadMCPServers: async () => {
    const servers = await SessionStorage.fetchMCPServers();
    set({ mcpServers: servers });

    MCPManager.subscribe(() => {
      get().refreshMCPStatuses();
    });

    for (const server of servers) {
      if (server.autoConnect && server.enabled) {
        MCPManager.addServer(server, true).catch((err) => {
          get().appendLog(`✗ MCP auto-connect failed: ${server.name} — ${err.message}`);
        });
      } else {
        MCPManager.addServer(server, false);
      }
    }
    get().refreshMCPStatuses();
  },

  addMCPServer: async (serverData) => {
    const config: MCPServerConfig = {
      ...serverData,
      id: uuidv4(),
    };
    await SessionStorage.saveMCPServer(config);
    set(s => ({ mcpServers: [...s.mcpServers, config] }));

    await MCPManager.addServer(config, config.autoConnect && config.enabled);
    get().refreshMCPStatuses();
    get().appendLog(`✓ MCP server added: ${config.name}`);
    return config.id;
  },

  removeMCPServer: async (id) => {
    await MCPManager.removeServer(id);
    await SessionStorage.deleteMCPServer(id);
    set(s => ({
      mcpServers: s.mcpServers.filter(m => m.id !== id),
    }));
    get().refreshMCPStatuses();
  },

  connectMCPServer: async (id) => {
    try {
      await MCPManager.connectServer(id);
      get().appendLog(`✓ MCP connected: ${get().mcpServers.find(s => s.id === id)?.name}`);
    } catch (err) {
      get().appendLog(`✗ MCP connect failed: ${(err as Error).message}`);
    }
    get().refreshMCPStatuses();
  },

  disconnectMCPServer: async (id) => {
    await MCPManager.disconnectServer(id);
    get().refreshMCPStatuses();
  },

  refreshMCPStatuses: () => {
    set({ mcpStatuses: MCPManager.getServerStatuses() });
  },
});
