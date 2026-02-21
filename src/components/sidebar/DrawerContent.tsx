/**
 * Sidebar — ChatGPT style: always dark, session list, subtle server integration.
 *
 * Uses Tamagui layout primitives (YStack, XStack, Text, Separator) but passes
 * sidebar-specific colors inline because the sidebar is always dark-themed and
 * does NOT use Tamagui theme tokens ($color, $background, etc.).
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, Separator } from 'tamagui';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAppStore } from '../../stores/appStore';
import { ConnectionBadge } from '../ConnectionBadge';
import { ACPConnectionState, SessionSummary, ServerType } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { APP_DISPLAY_NAME } from '../../constants/app';
import { getProviderInfo } from '../../ai/providers';
import { MCPConnectionState } from '../../mcp/types';
import { groupSessionsByDate } from '../../utils/sessionUtils';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useDesignSystem();
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

  const handleServerPress = useCallback(
    (id: string) => {
      if (selectedServerId === id) return;
      Haptics.selectionAsync();
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
  const groupedSessions = groupSessionsByDate(filteredSessions);

  const renderDeleteAction = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-80, -40, 0],
        outputRange: [1, 0.8, 0],
        extrapolate: 'clamp',
      });
      return (
        <XStack
          backgroundColor="#EF4444"
          justifyContent="center"
          alignItems="center"
          width={72}
          borderRadius={Radius.sm}
          marginBottom={1}
        >
          <Animated.Text style={{ fontSize: 18, transform: [{ scale }] }}>🗑</Animated.Text>
        </XStack>
      );
    },
    [],
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => {
      const isActive = item.id === selectedSessionId;
      return (
        <Swipeable
          renderRightActions={renderDeleteAction}
          onSwipeableOpen={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleDeleteSession(item.id);
          }}
          overshootRight={false}
          friction={2}
        >
          <TouchableOpacity
            style={{
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm + 2,
              borderRadius: Radius.sm,
              marginBottom: 1,
              ...(isActive && { backgroundColor: 'rgba(255,255,255,0.10)' }),
            }}
            onPress={() => handleSessionPress(item)}
            activeOpacity={0.6}
            accessibilityLabel={`Chat: ${item.title || 'New chat'}`}
            accessibilityHint="Swipe left to delete"
          >
            <Text
              color={colors.sidebarText}
              fontSize={FontSize.footnote}
              fontWeight="400"
              numberOfLines={1}
            >
              {item.title || 'New chat'}
            </Text>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [selectedSessionId, colors, handleSessionPress, handleDeleteSession, renderDeleteAction],
  );

  return (
    <YStack flex={1} backgroundColor={colors.sidebarBackground} paddingTop={insets.top}>
      {/* New chat button */}
      <YStack paddingHorizontal={Spacing.md} paddingVertical={Spacing.md}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm + 2,
            borderRadius: Radius.sm,
            gap: Spacing.sm,
          }}
          onPress={handleNewSession}
          disabled={!isInitialized}
          activeOpacity={0.7}
          accessibilityLabel="Start new chat"
        >
          <Text color={colors.sidebarText} fontSize={18} opacity={isInitialized ? 1 : 0.4}>✎</Text>
          <Text
            color={colors.sidebarText}
            fontSize={FontSize.subheadline}
            fontWeight="500"
            opacity={isInitialized ? 1 : 0.4}
          >
            New chat
          </Text>
        </TouchableOpacity>
      </YStack>

      {/* Search */}
      <XStack paddingHorizontal={Spacing.md} paddingBottom={Spacing.sm} alignItems="center">
        <TextInput
          style={{
            flex: 1,
            height: 36,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            paddingHorizontal: Spacing.sm + 2,
            fontSize: FontSize.footnote,
            color: colors.sidebarText,
          }}
          placeholder="Search chats..."
          placeholderTextColor={colors.sidebarTextSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={{ position: 'absolute', right: Spacing.md + 8, padding: 4 }}
          >
            <Text color={colors.sidebarTextSecondary} fontSize={16}>✕</Text>
          </TouchableOpacity>
        )}
      </XStack>

      {/* Server selector — compact */}
      <YStack paddingHorizontal={Spacing.md} gap={Spacing.xs}>
        {servers.length === 0 ? (
          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.sidebarSeparator,
              borderRadius: Radius.sm,
              paddingVertical: Spacing.md,
              alignItems: 'center',
            }}
            onPress={() => rootNav.navigate('AddServer')}
          >
            <Text color={colors.sidebarTextSecondary} fontSize={FontSize.footnote}>
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
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderRadius: Radius.sm,
                    ...(isSelected && { backgroundColor: 'rgba(255,255,255,0.06)' }),
                  }}
                  onPress={() => handleServerPress(server.id)}
                  activeOpacity={0.7}
                >
                  {providerIcon && (
                    <Text fontSize={14} marginRight={4}>{providerIcon}</Text>
                  )}
                  <Text
                    color={isSelected ? colors.sidebarText : colors.sidebarTextSecondary}
                    fontSize={FontSize.footnote}
                    fontWeight="500"
                    flex={1}
                    marginRight={Spacing.sm}
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
              <XStack
                alignItems="center"
                gap={Spacing.sm}
                paddingHorizontal={Spacing.md}
                marginTop={Spacing.xs}
              >
                <TouchableOpacity
                  style={{
                    paddingHorizontal: Spacing.lg,
                    paddingVertical: 6,
                    borderRadius: Radius.md,
                    backgroundColor: isConnected ? 'rgba(239,68,68,0.8)' : colors.primary,
                  }}
                  onPress={handleConnect}
                >
                  <Text color="#FFFFFF" fontSize={FontSize.caption} fontWeight="600">
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => rootNav.navigate('AddServer')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text color={colors.sidebarTextSecondary} fontSize={20} fontWeight="300">+</Text>
                </TouchableOpacity>
              </XStack>
            )}

            {selectedServer && selectedServer.serverType === ServerType.AIProvider && (
              <XStack
                alignItems="center"
                gap={Spacing.sm}
                paddingHorizontal={Spacing.md}
                marginTop={Spacing.xs}
              >
                <Text color={colors.primary} fontSize={FontSize.caption} fontWeight="600" flex={1}>
                  ✓ Ready
                </Text>
                <TouchableOpacity
                  onPress={() => rootNav.navigate('AddServer')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text color={colors.sidebarTextSecondary} fontSize={20} fontWeight="300">+</Text>
                </TouchableOpacity>
              </XStack>
            )}

            {agentInfo && (
              <Text
                color={colors.sidebarTextSecondary}
                fontSize={FontSize.caption}
                paddingHorizontal={Spacing.md}
                numberOfLines={1}
              >
                {agentInfo.name}
              </Text>
            )}

            {/* MCP tools indicator */}
            {(() => {
              const connectedMCP = mcpStatuses.filter(s => s.state === MCPConnectionState.Connected);
              const totalTools = connectedMCP.reduce((sum, s) => sum + s.toolCount, 0);
              if (totalTools === 0) return null;
              return (
                <Text
                  color={colors.primary}
                  fontSize={FontSize.caption}
                  paddingHorizontal={Spacing.md}
                  marginTop={2}
                >
                  🔌 {totalTools} MCP tool{totalTools !== 1 ? 's' : ''} from {connectedMCP.length} server{connectedMCP.length !== 1 ? 's' : ''}
                </Text>
              );
            })()}
          </>
        )}

        {connectionError && (
          <Text
            color="#F87171"
            fontSize={FontSize.caption}
            paddingHorizontal={Spacing.md}
            numberOfLines={2}
          >
            {connectionError}
          </Text>
        )}
      </YStack>

      {/* Separator */}
      <Separator
        borderColor={colors.sidebarSeparator}
        marginHorizontal={Spacing.md}
        marginVertical={Spacing.md}
      />

      {/* Sessions list */}
      <FlatList
        data={filteredSessions}
        keyExtractor={item => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={
          filteredSessions.length === 0
            ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
            : { paddingHorizontal: Spacing.md }
        }
        ListEmptyComponent={
          <Text
            color={colors.sidebarTextSecondary}
            fontSize={FontSize.footnote}
            textAlign="center"
            paddingTop={Spacing.xxl}
          >
            {isInitialized ? 'No chats yet' : 'Connect to start'}
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadSessions} tintColor={colors.sidebarText} />
        }
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        maxToRenderPerBatch={15}
        updateCellsBatchingPeriod={50}
      />

      {/* Footer — settings only */}
      <XStack
        paddingHorizontal={Spacing.md}
        paddingTop={Spacing.sm}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor={colors.sidebarSeparator}
        paddingBottom={insets.bottom + 8}
      >
        <TouchableOpacity
          style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm }}
          onPress={() => rootNav.navigate('Settings')}
        >
          <Text color={colors.sidebarText} fontSize={20}>⚙</Text>
        </TouchableOpacity>
      </XStack>
    </YStack>
  );
}
