/**
 * HomeScreen – Server list + session sidebar.
 * Mirrors ContentView from the Swift app.
 */

import React, { useEffect, useCallback } from 'react';
import {
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
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
      {/* Server List */}
      <YStack marginBottom={Spacing.sm}>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal={Spacing.lg}
          paddingVertical={Spacing.sm}
        >
          <Text color="$color" fontSize={FontSize.headline} fontWeight="600">Servers</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddServer')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityLabel="Add server"
          >
            <Text color={colors.surface} fontSize={20} fontWeight="600" marginTop={-2}>+</Text>
          </TouchableOpacity>
        </XStack>

        {servers.length === 0 ? (
          <YStack alignItems="center" paddingVertical={Spacing.xxl} gap={Spacing.md}>
            <Text color="$textTertiary" fontSize={FontSize.body}>
              Get started by adding your first server
            </Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.sm,
                backgroundColor: colors.primary,
                borderRadius: Radius.md,
              }}
              onPress={() => navigation.navigate('AddServer')}
              accessibilityLabel="Add server"
            >
              <Text color={colors.surface} fontSize={FontSize.body} fontWeight="600">Add Server</Text>
            </TouchableOpacity>
          </YStack>
        ) : (
          <FlatList
            data={servers}
            keyExtractor={item => item.id}
            renderItem={renderServerItem}
            style={{ maxHeight: 200 }}
          />
        )}
      </YStack>

      {/* Selected Server Actions */}
      {selectedServer && (
        <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.sm} gap={Spacing.sm}>
          {connectionError && (
            <>
              <Text
                color={colors.destructive}
                fontSize={FontSize.caption}
                textAlign="center"
                numberOfLines={2}
              >
                {connectionError}
              </Text>
              <TouchableOpacity
                style={{
                  alignSelf: 'center',
                  paddingHorizontal: Spacing.lg,
                  paddingVertical: Spacing.xs,
                  borderWidth: 1,
                  borderColor: colors.destructive,
                  borderRadius: Radius.md,
                }}
                onPress={() => connect()}
                accessibilityLabel="Retry connection"
              >
                <Text color={colors.destructive} fontSize={FontSize.caption} fontWeight="600">Retry</Text>
              </TouchableOpacity>
            </>
          )}
          <XStack gap={Spacing.sm}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: Spacing.sm,
                alignItems: 'center',
                borderRadius: Radius.md,
                backgroundColor: isConnected ? colors.destructive : colors.primary,
              }}
              onPress={handleConnect}
              accessibilityLabel={isConnected ? 'Disconnect from server' : 'Connect to server'}
            >
              <Text color={colors.surface} fontSize={FontSize.body} fontWeight="600">
                {isConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>

            {isInitialized && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: Spacing.sm,
                  alignItems: 'center',
                  backgroundColor: colors.healthyGreen,
                  borderRadius: Radius.md,
                }}
                onPress={handleNewSession}
                accessibilityLabel="Create new session"
              >
                <Text color={colors.surface} fontSize={FontSize.body} fontWeight="600">New Session</Text>
              </TouchableOpacity>
            )}
          </XStack>

          {agentInfo && (
            <Text color="$textTertiary" fontSize={FontSize.caption} textAlign="center">
              {agentInfo.name} {agentInfo.version}
            </Text>
          )}
        </YStack>
      )}

      {/* Session List */}
      {selectedServer && (
        <YStack flex={1} marginBottom={Spacing.sm}>
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={Spacing.lg}
            paddingVertical={Spacing.sm}
          >
            <Text color="$color" fontSize={FontSize.headline} fontWeight="600">
              Sessions {sessions.length > 0 ? `(${sessions.length})` : ''}
            </Text>
            {isInitialized && sessions.length > 0 && (
              <TouchableOpacity onPress={loadSessions}>
                <Text color={colors.primary} fontSize={FontSize.caption} fontWeight="600">
                  Refresh
                </Text>
              </TouchableOpacity>
            )}
          </XStack>

          {sessions.length === 0 ? (
            <YStack alignItems="center" paddingVertical={Spacing.xl} gap={Spacing.sm}>
              <Text color="$textTertiary" fontSize={FontSize.body}>
                {isInitialized
                  ? 'No sessions yet — tap "New Session" to start'
                  : 'Connect to see sessions'}
              </Text>
            </YStack>
          ) : (
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
              style={{ flex: 1 }}
            />
          )}
        </YStack>
      )}
    </YStack>
  );
}
