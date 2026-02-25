/**
 * useDrawerState — state, computed values, and handlers for DrawerContent.
 * Follows the w. prefix pattern for clean JSX consumption.
 */

import { useCallback, useState, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServers, useSelectedServerId, useConnectionState, useIsInitialized, useAgentInfo, useSessions, useSelectedSessionId, useConnectionError, useMCPStatuses, useServerActions, useSessionActions } from '../stores/selectors';
import { useAppStore, type CliSessionInfo } from '../stores/appStore';
import { ACPConnectionState, SessionSummary, ServerType, ACPServerConfiguration } from '../acp-hex/domain/types';
import { getProviderInfo } from '../ai/providers';
import { groupSessionsByDate } from '../utils/sessionUtils';
import { MCPConnectionState } from '../mcp/types';
import type { RootStackParamList } from '../navigation';

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export function useDrawerState(drawerNav: { closeDrawer: () => void }) {
  const rootNav = useNavigation<RootNavProp>();
  const servers = useServers();
  const selectedServerId = useSelectedServerId();
  const connectionState = useConnectionState();
  const isInitialized = useIsInitialized();
  const agentInfo = useAgentInfo();
  const sessions = useSessions();
  const cliSessions = useAppStore(s => s.cliSessions);
  const selectedSessionId = useSelectedSessionId();
  const connectionError = useConnectionError();
  const mcpStatuses = useMCPStatuses();
  const { loadServers, selectServer, connect, disconnect, deleteServer } = useServerActions();
  const { createSession, selectSession, deleteSession, loadSessions } = useSessionActions();

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isConnected = connectionState === ACPConnectionState.Connected;

  // CLI session filter
  const [showInactiveCli, setShowInactiveCli] = useState(false);

  // Merge CLI sessions into session list
  const allSessions = useMemo(() => {
    const cliAsSummary: SessionSummary[] = cliSessions.map((cli: CliSessionInfo) => ({
      id: `cli:${cli.id}`,
      title: cli.summary || cli.cwd?.split('/').pop() || 'CLI Session',
      description: cli.branch ? `${cli.branch} • ${cli.cwd || ''}` : cli.cwd || '',
      createdAt: cli.createdAt,
      updatedAt: cli.updatedAt,
      cwd: cli.cwd || undefined,
      isCliSession: true,
      isAlive: cli.isAlive,
    }));
    const alive = cliAsSummary.filter(s => s.isAlive);
    const inactive = cliAsSummary.filter(s => !s.isAlive);
    return [...alive, ...(showInactiveCli ? inactive : []), ...sessions];
  }, [sessions, cliSessions, showInactiveCli]);

  const inactiveCliCount = useMemo(
    () => cliSessions.filter((c: CliSessionInfo) => !c.isAlive).length,
    [cliSessions],
  );

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return allSessions;
    const q = searchQuery.toLowerCase();
    return allSessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  }, [allSessions, searchQuery]);

  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

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

  const loadCliSessionTurns = useAppStore(s => s.loadCliSessionTurns);
  const startCliWatch = useAppStore(s => s.startCliWatch);

  const handleSessionPress = useCallback((session: SessionSummary) => {
    selectSession(session.id);
    if (session.isCliSession) {
      const cliId = session.id.replace(/^cli:/, '');
      loadCliSessionTurns(cliId);
      startCliWatch();
    }
    drawerNav.closeDrawer();
  }, [selectSession, loadCliSessionTurns, startCliWatch, drawerNav]);

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
    showInactiveCli, setShowInactiveCli,
    inactiveCliCount,
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
