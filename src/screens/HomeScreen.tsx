/**
 * HomeScreen – Server list + session sidebar.
 * Mirrors ContentView from the Swift app.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ACPConnectionState, SessionSummary } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useDesignSystem();
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
    loadSessions,
  } = useAppStore();

  useEffect(() => {
    loadServers();
  }, []);

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isConnected = connectionState === ACPConnectionState.Connected;

  const handleServerPress = useCallback(
    (id: string) => {
      if (selectedServerId === id) return;
      selectServer(id);
    },
    [selectedServerId, selectServer],
  );

  const handleConnect = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleSessionPress = useCallback(
    (session: SessionSummary) => {
      selectSession(session.id);
      navigation.navigate('Session');
    },
    [selectSession, navigation],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      Alert.alert('Delete Session', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSession(sessionId),
        },
      ]);
    },
    [deleteSession],
  );

  const renderServerItem = useCallback(
    ({ item }: { item: typeof servers[0] }) => {
      const isSelected = item.id === selectedServerId;
      return (
        <TouchableOpacity
          style={[
            styles.serverItem,
            { backgroundColor: colors.cardBackground, borderRadius: Radius.md, ...Platform.select({ android: { elevation: 1 } }) },
            isSelected && { backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: colors.primary },
          ]}
          onPress={() => handleServerPress(item.id)}
          activeOpacity={0.7}
          accessibilityLabel={`Server: ${item.name || item.host}`}
        >
          <View style={styles.serverInfo}>
            <Text style={[styles.serverName, { color: colors.text }]} numberOfLines={1}>
              {item.name || item.host}
            </Text>
            <Text style={[styles.serverHost, { color: colors.textTertiary }]} numberOfLines={1}>
              {item.scheme}://{item.host}
            </Text>
          </View>
          {isSelected && (
            <ConnectionBadge
              state={connectionState}
              isInitialized={isInitialized}
            />
          )}
        </TouchableOpacity>
      );
    },
    [selectedServerId, connectionState, isInitialized, handleServerPress, colors],
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => {
      const isSelected = item.id === selectedSessionId;
      return (
        <TouchableOpacity
          style={[
            styles.sessionItem,
            { backgroundColor: colors.cardBackground, borderRadius: Radius.md, ...Platform.select({ android: { elevation: 1 } }) },
            isSelected && { backgroundColor: `${colors.primary}15` },
          ]}
          onPress={() => handleSessionPress(item)}
          onLongPress={() => handleDeleteSession(item.id)}
          activeOpacity={0.7}
          accessibilityLabel={`Session: ${item.title || 'New Session'}`}
        >
          <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || 'New Session'}
          </Text>
          {item.updatedAt && (
            <Text style={[styles.sessionDate, { color: colors.textTertiary }]}>
              {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
          )}
        </TouchableOpacity>
      );
    },
    [selectedSessionId, handleSessionPress, handleDeleteSession, colors],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.systemGray6 }]}>
      {/* Server List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Servers</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddServer')}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            accessibilityLabel="Add server"
          >
            <Text style={[styles.addButtonText, { color: colors.surface }]}>+</Text>
          </TouchableOpacity>
        </View>

        {servers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Get started by adding your first server
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary, borderRadius: Radius.md }]}
              onPress={() => navigation.navigate('AddServer')}
              accessibilityLabel="Add server"
            >
              <Text style={[styles.emptyButtonText, { color: colors.surface }]}>Add Server</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={servers}
            keyExtractor={item => item.id}
            renderItem={renderServerItem}
            style={styles.serverList}
          />
        )}
      </View>

      {/* Selected Server Actions */}
      {selectedServer && (
        <View style={styles.serverActions}>
          {connectionError && (
            <>
              <Text style={[styles.errorText, { color: colors.destructive }]} numberOfLines={2}>
                {connectionError}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { borderColor: colors.destructive, borderRadius: Radius.md }]}
                onPress={() => connect()}
                accessibilityLabel="Retry connection"
              >
                <Text style={[styles.retryButtonText, { color: colors.destructive }]}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderRadius: Radius.md },
                isConnected
                  ? { backgroundColor: colors.destructive }
                  : { backgroundColor: colors.primary },
              ]}
              onPress={handleConnect}
              accessibilityLabel={isConnected ? 'Disconnect from server' : 'Connect to server'}
            >
              <Text style={[styles.actionButtonText, { color: colors.surface }]}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>

            {isInitialized && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.healthyGreen, borderRadius: Radius.md }]}
                onPress={handleNewSession}
                accessibilityLabel="Create new session"
              >
                <Text style={[styles.actionButtonText, { color: colors.surface }]}>New Session</Text>
              </TouchableOpacity>
            )}
          </View>

          {agentInfo && (
            <Text style={[styles.agentInfoText, { color: colors.textTertiary }]}>
              {agentInfo.name} {agentInfo.version}
            </Text>
          )}
        </View>
      )}

      {/* Session List */}
      {selectedServer && sessions.length > 0 && (
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sessions</Text>
          <FlatList
            data={sessions}
            keyExtractor={item => item.id}
            renderItem={renderSessionItem}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={loadSessions}
              />
            }
            style={styles.sessionList}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.headline,
    fontWeight: '600',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: -2,
  },
  serverList: {
    maxHeight: 200,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: 2,
  },
  serverInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serverName: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
  serverHost: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  serverActions: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  agentInfoText: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  sessionList: {
    flex: 1,
  },
  sessionItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginVertical: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTitle: {
    fontSize: FontSize.body,
    flex: 1,
  },
  sessionDate: {
    fontSize: FontSize.caption,
    marginLeft: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.body,
  },
  emptyButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  emptyButtonText: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
});
