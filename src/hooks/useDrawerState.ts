/**
 * useDrawerState — state, computed values, and handlers for DrawerContent.
 * Follows the w. prefix pattern for clean JSX consumption.
 */

import { useCallback, useState, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ACPConnectionState, SessionSummary, ServerType, ACPServerConfiguration } from '../acp/models/types';
import { getProviderInfo } from '../ai/providers';
import { groupSessionsByDate } from '../utils/sessionUtils';
import { MCPConnectionState } from '../mcp/types';
import type { RootStackParamList } from '../navigation';

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export function useDrawerState(drawerNav: { closeDrawer: () => void }) {
  const rootNav = useNavigation<RootNavProp>();
  const {
    servers,
    selectedServerId,
    connectionState,
    isInitialized,
    agentInfo,
    sessions,
    selectedSessionId,
    connectionError,
    loadServers,
    selectServer,
    connect,
    disconnect,
    createSession,
    selectSession,
    deleteSession,
    deleteServer,
    loadSessions,
    mcpStatuses,
  } = useAppStore();

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isConnected = connectionState === ACPConnectionState.Connected;

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const groupedSessions = groupSessionsByDate(filteredSessions);

  // MCP tools summary
  const mcpSummary = useMemo(() => {
    const connected = mcpStatuses.filter(s => s.state === MCPConnectionState.Connected);
    const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
    return { serverCount: connected.length, totalTools };
  }, [mcpStatuses]);

  // ── Handlers ──

  const handleServerPress = useCallback((id: string) => {
    if (selectedServerId === id) return;
    Haptics.selectionAsync();
    selectServer(id);
  }, [selectedServerId, selectServer]);

  const handleConnect = useCallback(() => {
    if (isConnected) disconnect();
    else connect();
  }, [isConnected, connect, disconnect]);

  const handleNewSession = useCallback(() => {
    createSession().then(() => drawerNav.closeDrawer());
  }, [createSession, drawerNav]);

  const handleSessionPress = useCallback((session: SessionSummary) => {
    selectSession(session.id);
    drawerNav.closeDrawer();
  }, [selectSession, drawerNav]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(sessionId) },
    ]);
  }, [deleteSession]);

  const handleServerLongPress = useCallback((server: ACPServerConfiguration) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(server.name || server.host, undefined, [
      { text: 'Edit', onPress: () => rootNav.navigate('QuickSetup', { editingServer: server }) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Server', `Remove "${server.name || server.host}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteServer(server.id) },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [rootNav, deleteServer]);

  const navigateToQuickSetup = useCallback(() => rootNav.navigate('QuickSetup'), [rootNav]);
  const navigateToSettings = useCallback(() => rootNav.navigate('Settings'), [rootNav]);

  return {
    // Store values
    servers,
    selectedServerId,
    connectionState,
    isInitialized,
    agentInfo,
    selectedSessionId,
    connectionError,
    loadSessions,
    // Computed
    selectedServer,
    isConnected,
    searchQuery, setSearchQuery,
    filteredSessions,
    groupedSessions,
    mcpSummary,
    // Handlers
    handleServerPress,
    handleConnect,
    handleNewSession,
    handleSessionPress,
    handleDeleteSession,
    handleServerLongPress,
    navigateToQuickSetup,
    navigateToSettings,
  };
}
