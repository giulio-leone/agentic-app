/**
 * Custom drawer sidebar content: server selector, session list, settings link.
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
import { ACPConnectionState, SessionSummary } from '../../acp/models/types';
import { useTheme, FontSize, Spacing, Radius } from '../../utils/theme';
import { APP_DISPLAY_NAME } from '../../constants/app';

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

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => {
      const isActive = item.id === selectedSessionId;
      return (
        <TouchableOpacity
          style={[
            styles.sessionItem,
            { backgroundColor: isActive ? colors.sidebarItemActive : 'transparent' },
          ]}
          onPress={() => handleSessionPress(item)}
          onLongPress={() => handleDeleteSession(item.id)}
          activeOpacity={0.6}
        >
          <Text style={[styles.sessionIcon]}>💬</Text>
          <View style={styles.sessionTextContainer}>
            <Text
              style={[styles.sessionTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title || 'New Session'}
            </Text>
            {item.updatedAt && (
              <Text style={[styles.sessionDate, { color: colors.textTertiary }]}>
                {formatDate(item.updatedAt)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedSessionId, colors, handleSessionPress, handleDeleteSession],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.sidebarBackground, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text style={[styles.appName, { color: colors.text }]}>{APP_DISPLAY_NAME}</Text>
        {selectedServer && (
          <ConnectionBadge state={connectionState} isInitialized={isInitialized} />
        )}
      </View>

      {/* Server selector */}
      <View style={styles.serverSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SERVER</Text>
          <TouchableOpacity
            onPress={() => {
              rootNav.navigate('AddServer');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.addIcon, { color: colors.primary }]}>＋</Text>
          </TouchableOpacity>
        </View>

        {servers.length === 0 ? (
          <TouchableOpacity
            style={[styles.emptyServerButton, { borderColor: colors.separator }]}
            onPress={() => {
              rootNav.navigate('AddServer');
            }}
          >
            <Text style={[styles.emptyServerText, { color: colors.textTertiary }]}>
              Add a server to get started
            </Text>
          </TouchableOpacity>
        ) : (
          servers.map(server => {
            const isSelected = server.id === selectedServerId;
            return (
              <TouchableOpacity
                key={server.id}
                style={[
                  styles.serverChip,
                  {
                    backgroundColor: isSelected ? colors.primaryMuted : colors.sidebarItem,
                    borderColor: isSelected ? colors.primary : colors.separator,
                  },
                ]}
                onPress={() => handleServerPress(server.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.serverName,
                    { color: isSelected ? colors.primary : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {server.name || server.host}
                </Text>
              </TouchableOpacity>
            );
          })
        )}

        {selectedServer && (
          <View style={styles.connectRow}>
            <TouchableOpacity
              style={[
                styles.connectButton,
                {
                  backgroundColor: isConnected ? colors.destructive : colors.primary,
                },
              ]}
              onPress={handleConnect}
            >
              <Text style={styles.connectButtonText}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>
            {agentInfo && (
              <Text style={[styles.agentName, { color: colors.textTertiary }]} numberOfLines={1}>
                {agentInfo.name}
              </Text>
            )}
          </View>
        )}

        {connectionError && (
          <Text style={[styles.errorText, { color: colors.destructive }]} numberOfLines={2}>
            {connectionError}
          </Text>
        )}
      </View>

      {/* Sessions */}
      <View style={styles.sessionsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SESSIONS</Text>
          {isInitialized && (
            <TouchableOpacity onPress={handleNewSession} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.addIcon, { color: colors.primary }]}>＋</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderSessionItem}
          contentContainerStyle={sessions.length === 0 ? styles.emptySessionsList : undefined}
          ListEmptyComponent={
            <Text style={[styles.emptySessionsText, { color: colors.textTertiary }]}>
              {isInitialized ? 'No sessions yet' : 'Connect to see sessions'}
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadSessions} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Bottom actions */}
      <View style={[styles.footer, { borderTopColor: colors.separator, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            rootNav.navigate('Settings');
          }}
        >
          <Text style={styles.footerIcon}>⚙️</Text>
          <Text style={[styles.footerLabel, { color: colors.text }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: {
    fontSize: FontSize.title3,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  serverSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  addIcon: {
    fontSize: 18,
    fontWeight: '500',
  },
  emptyServerButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  emptyServerText: {
    fontSize: FontSize.footnote,
  },
  serverChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  serverName: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  connectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  connectButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.footnote,
    fontWeight: '600',
  },
  agentName: {
    fontSize: FontSize.caption,
    flex: 1,
  },
  errorText: {
    fontSize: FontSize.caption,
  },
  sessionsSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
    marginBottom: 2,
    gap: Spacing.sm,
  },
  sessionIcon: {
    fontSize: 16,
  },
  sessionTextContainer: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: FontSize.caption - 1,
    marginTop: 1,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  footerIcon: {
    fontSize: 18,
  },
  footerLabel: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
});
