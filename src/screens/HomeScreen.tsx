/**
 * HomeScreen – Server list + session sidebar with native-feeling UI.
 */

import React, { useEffect, useCallback } from 'react';
import {
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Server, MessageSquare, Wifi, WifiOff } from 'lucide-react-native';
import {
  useServers, useSelectedServerId, useConnectionState, useIsInitialized,
  useAgentInfo, useSessions, useSelectedSessionId, useConnectionError,
  useServerActions, useSessionActions,
} from '../stores/selectors';
import { ServerListItem } from '../components/home/ServerListItem';
import { SessionListItem } from '../components/home/SessionListItem';
import { ACPConnectionState, SessionSummary } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useDesignSystem();

  const servers = useServers();
  const selectedServerId = useSelectedServerId();
  const connectionState = useConnectionState();
  const isInitialized = useIsInitialized();
  const agentInfo = useAgentInfo();
  const sessions = useSessions();
  const selectedSessionId = useSelectedSessionId();
  const connectionError = useConnectionError();
  const { loadServers, selectServer, connect, disconnect } = useServerActions();
  const { createSession, selectSession, deleteSession, loadSessions } = useSessionActions();

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
    if (isConnected) disconnect();
    else connect();
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
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(sessionId) },
      ]);
    },
    [deleteSession],
  );

  const renderServerItem = useCallback(
    ({ item }: { item: typeof servers[0] }) => (
      <ServerListItem
        server={item}
        isSelected={item.id === selectedServerId}
        connectionState={connectionState}
        isInitialized={isInitialized}
        onPress={handleServerPress}
        colors={colors}
      />
    ),
    [selectedServerId, connectionState, isInitialized, handleServerPress, colors],
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => (
      <SessionListItem
        session={item}
        isSelected={item.id === selectedSessionId}
        onPress={handleSessionPress}
        onDelete={handleDeleteSession}
        colors={colors}
      />
    ),
    [selectedSessionId, handleSessionPress, handleDeleteSession, colors],
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* ── Servers Section ── */}
      <YStack>
        <SectionHeader
          title="Servers"
          count={servers.length}
          colors={colors}
          action={
            <TouchableOpacity
              onPress={() => navigation.navigate('AddServer')}
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              accessibilityLabel="Add server"
            >
              <Plus size={16} color={colors.surface} strokeWidth={2.5} />
            </TouchableOpacity>
          }
        />

        {servers.length === 0 ? (
          <EmptyState
            icon={<Server size={32} color={colors.textTertiary} />}
            title="No servers configured"
            subtitle="Add a server to get started"
            buttonLabel="Add Server"
            onPress={() => navigation.navigate('AddServer')}
            colors={colors}
          />
        ) : (
          <FlatList
            data={servers}
            keyExtractor={item => item.id}
            renderItem={renderServerItem}
            scrollEnabled={servers.length > 3}
            style={servers.length > 3 ? { maxHeight: 240 } : undefined}
          />
        )}
      </YStack>

      {/* ── Connection Bar ── */}
      {selectedServer && (
        <XStack
          alignItems="center"
          paddingHorizontal={Spacing.lg}
          paddingVertical={Spacing.sm}
          gap={Spacing.sm}
        >
          {connectionError && (
            <Text color={colors.destructive} fontSize={12} flex={1} numberOfLines={1}>
              {connectionError}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleConnect}
            style={[
              styles.connectionButton,
              { backgroundColor: isConnected ? `${colors.destructive}15` : `${colors.primary}15` },
            ]}
            accessibilityLabel={isConnected ? 'Disconnect' : 'Connect'}
          >
            {isConnected
              ? <WifiOff size={14} color={colors.destructive} />
              : <Wifi size={14} color={colors.primary} />
            }
            <Text
              fontSize={13}
              fontWeight="600"
              color={isConnected ? colors.destructive : colors.primary}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>

          {isInitialized && (
            <TouchableOpacity
              onPress={handleNewSession}
              style={[styles.connectionButton, { backgroundColor: `${colors.healthyGreen}15` }]}
              accessibilityLabel="New session"
            >
              <Plus size={14} color={colors.healthyGreen} />
              <Text fontSize={13} fontWeight="600" color={colors.healthyGreen}>
                New Session
              </Text>
            </TouchableOpacity>
          )}

          {agentInfo && (
            <Text color={colors.textTertiary} fontSize={11}>
              {agentInfo.name} {agentInfo.version}
            </Text>
          )}
        </XStack>
      )}

      {/* ── Sessions Section ── */}
      {selectedServer && (
        <YStack flex={1}>
          <SectionHeader
            title="Sessions"
            count={sessions.length}
            colors={colors}
            action={
              isInitialized && sessions.length > 0 ? (
                <TouchableOpacity onPress={loadSessions}>
                  <Text color={colors.primary} fontSize={13} fontWeight="600">Refresh</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />

          {sessions.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={32} color={colors.textTertiary} />}
              title={isInitialized ? 'No sessions yet' : 'Connect to see sessions'}
              subtitle={isInitialized ? 'Tap "New Session" to start' : undefined}
              colors={colors}
            />
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={item => item.id}
              renderItem={renderSessionItem}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={loadSessions} />
              }
              style={{ flex: 1 }}
            />
          )}
        </YStack>
      )}
    </YStack>
  );
}

/** Reusable section header with optional action */
function SectionHeader({
  title,
  count,
  colors,
  action,
}: {
  title: string;
  count: number;
  colors: { text: string; textTertiary: string };
  action?: React.ReactNode;
}) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal={Spacing.lg}
      paddingVertical={Spacing.sm}
    >
      <XStack alignItems="baseline" gap={6}>
        <Text color={colors.text} fontSize={FontSize.headline} fontWeight="700">{title}</Text>
        {count > 0 && (
          <Text color={colors.textTertiary} fontSize={13}>{count}</Text>
        )}
      </XStack>
      {action}
    </XStack>
  );
}

/** Reusable empty state with icon and optional button */
function EmptyState({
  icon,
  title,
  subtitle,
  buttonLabel,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onPress?: () => void;
  colors: { primary: string; surface: string; textTertiary: string };
}) {
  return (
    <YStack alignItems="center" paddingVertical={Spacing.xl} gap={Spacing.sm}>
      {icon}
      <Text color={colors.textTertiary} fontSize={15} fontWeight="500">{title}</Text>
      {subtitle && <Text color={colors.textTertiary} fontSize={13}>{subtitle}</Text>}
      {buttonLabel && onPress && (
        <TouchableOpacity
          onPress={onPress}
          style={[styles.emptyButton, { backgroundColor: colors.primary }]}
        >
          <Text color={colors.surface} fontSize={14} fontWeight="600">{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  emptyButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
});
