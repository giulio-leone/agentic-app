/**
 * Sidebar — ChatGPT style: always dark, session list, subtle server integration.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAppStore } from '../../stores/appStore';
import { ConnectionBadge } from '../ConnectionBadge';
import { ACPConnectionState, SessionSummary, ServerType } from '../../acp/models/types';
import { useTheme, FontSize, Spacing, Radius } from '../../utils/theme';
import { APP_DISPLAY_NAME } from '../../constants/app';
import { getProviderInfo } from '../../ai/providers';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = props.navigation;
  const rootNav = useNavigation<any>();
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
    createSession().then(() => {
      navigation.closeDrawer();
    });
  }, [createSession, navigation]);

  const handleSessionPress = useCallback(
    (session: SessionSummary) => {
      selectSession(session.id);
      navigation.closeDrawer();
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

  // Group sessions by date
  const groupedSessions = groupSessionsByDate(sessions);

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => {
      const isActive = item.id === selectedSessionId;
      return (
        <TouchableOpacity
          style={[
            styles.sessionItem,
            isActive && styles.sessionItemActive,
          ]}
          onPress={() => handleSessionPress(item)}
          onLongPress={() => handleDeleteSession(item.id)}
          activeOpacity={0.6}
        >
          <Text
            style={[styles.sessionTitle, { color: colors.sidebarText }]}
            numberOfLines={1}
          >
            {item.title || 'New chat'}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedSessionId, colors, handleSessionPress, handleDeleteSession],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.sidebarBackground, paddingTop: insets.top }]}>
      {/* New chat button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={handleNewSession}
          disabled={!isInitialized}
          activeOpacity={0.7}
        >
          <Text style={[styles.newChatIcon, { color: colors.sidebarText, opacity: isInitialized ? 1 : 0.4 }]}>✎</Text>
          <Text style={[styles.newChatText, { color: colors.sidebarText, opacity: isInitialized ? 1 : 0.4 }]}>New chat</Text>
        </TouchableOpacity>
      </View>

      {/* Server selector — compact */}
      <View style={styles.serverSection}>
        {servers.length === 0 ? (
          <TouchableOpacity
            style={[styles.addServerButton, { borderColor: colors.sidebarSeparator }]}
            onPress={() => rootNav.navigate('AddServer')}
          >
            <Text style={[styles.addServerText, { color: colors.sidebarTextSecondary }]}>
              + Add a server
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {servers.map(server => {
              const isSelected = server.id === selectedServerId;
              const isAIProvider = server.serverType === ServerType.AIProvider;
              const providerIcon = isAIProvider && server.aiProviderConfig
                ? getProviderInfo(server.aiProviderConfig.providerType).icon
                : null;
              return (
                <TouchableOpacity
                  key={server.id}
                  style={[
                    styles.serverChip,
                    isSelected && styles.serverChipSelected,
                  ]}
                  onPress={() => handleServerPress(server.id)}
                  activeOpacity={0.7}
                >
                  {providerIcon && (
                    <Text style={styles.providerIcon}>{providerIcon}</Text>
                  )}
                  <Text
                    style={[
                      styles.serverName,
                      { color: isSelected ? colors.sidebarText : colors.sidebarTextSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {server.name || server.host}
                  </Text>
                  {isSelected && !isAIProvider && (
                    <ConnectionBadge state={connectionState} isInitialized={isInitialized} />
                  )}
                </TouchableOpacity>
              );
            })}

            {selectedServer && selectedServer.serverType !== ServerType.AIProvider && (
              <View style={styles.connectRow}>
                <TouchableOpacity
                  style={[
                    styles.connectButton,
                    { backgroundColor: isConnected ? 'rgba(239,68,68,0.8)' : colors.primary },
                  ]}
                  onPress={handleConnect}
                >
                  <Text style={styles.connectButtonText}>
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => rootNav.navigate('AddServer')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.addIcon, { color: colors.sidebarTextSecondary }]}>+</Text>
                </TouchableOpacity>
              </View>
            )}

            {agentInfo && (
              <Text style={[styles.agentName, { color: colors.sidebarTextSecondary }]} numberOfLines={1}>
                {agentInfo.name}
              </Text>
            )}
          </>
        )}

        {connectionError && (
          <Text style={[styles.errorText, { color: '#F87171' }]} numberOfLines={2}>
            {connectionError}
          </Text>
        )}
      </View>

      {/* Separator */}
      <View style={[styles.divider, { backgroundColor: colors.sidebarSeparator }]} />

      {/* Sessions list */}
      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={sessions.length === 0 ? styles.emptySessionsList : styles.sessionsList}
        ListEmptyComponent={
          <Text style={[styles.emptySessionsText, { color: colors.sidebarTextSecondary }]}>
            {isInitialized ? 'No chats yet' : 'Connect to start'}
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadSessions} tintColor={colors.sidebarText} />
        }
        showsVerticalScrollIndicator={false}
        style={styles.sessionsContainer}
      />

      {/* Footer — settings only */}
      <View style={[styles.footer, { borderTopColor: colors.sidebarSeparator, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => rootNav.navigate('Settings')}
        >
          <Text style={[styles.footerIcon, { color: colors.sidebarText }]}>⚙</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function groupSessionsByDate(sessions: SessionSummary[]): { label: string; data: SessionSummary[] }[] {
  if (sessions.length === 0) return [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, SessionSummary[]> = {};

  for (const session of sessions) {
    const d = session.updatedAt ? new Date(session.updatedAt) : new Date();
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'Previous 7 days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(session);
  }

  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  return order.filter(l => groups[l]).map(l => ({ label: l, data: groups[l] }));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
  },
  newChatIcon: {
    fontSize: 18,
  },
  newChatText: {
    fontSize: FontSize.subheadline,
    fontWeight: '500',
  },
  serverSection: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  addServerButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addServerText: {
    fontSize: FontSize.footnote,
  },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  serverChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  providerIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  serverName: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.sm,
  },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  connectButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  addIcon: {
    fontSize: 20,
    fontWeight: '300',
  },
  agentName: {
    fontSize: FontSize.caption,
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.caption,
    paddingHorizontal: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },
  sessionsContainer: {
    flex: 1,
  },
  sessionsList: {
    paddingHorizontal: Spacing.md,
  },
  sessionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
    marginBottom: 1,
  },
  sessionItemActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sessionTitle: {
    fontSize: FontSize.footnote,
    fontWeight: '400',
  },
  emptySessionsList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: FontSize.footnote,
    textAlign: 'center',
    paddingTop: Spacing.xxl,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  footerButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  footerIcon: {
    fontSize: 20,
  },
});
