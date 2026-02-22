/**
 * Sidebar — ChatGPT style: always dark, session list, subtle server integration.
 * Logic extracted to useDrawerState hook.
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  Animated,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, Separator } from 'tamagui';
import { Trash2, X, PenLine, Settings, Check, Plus, Terminal, Github, Server } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ConnectionBadge } from '../ConnectionBadge';
import { SessionSummary, ServerType } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { getProviderInfo } from '../../ai/providers';
import { useDrawerState } from '../../hooks/useDrawerState';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const w = useDrawerState(props.navigation);

  const renderDeleteAction = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-80, -40, 0],
        outputRange: [1, 0.8, 0],
        extrapolate: 'clamp',
      });
      return (
        <XStack
          backgroundColor={colors.destructive}
          justifyContent="center"
          alignItems="center"
          width={72}
          borderRadius={Radius.sm}
          marginBottom={1}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Trash2 size={18} color={colors.contrastText} />
          </Animated.View>
        </XStack>
      );
    },
    [],
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: SessionSummary }) => {
      const isActive = item.id === w.selectedSessionId;
      return (
        <Swipeable
          renderRightActions={renderDeleteAction}
          onSwipeableOpen={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            w.handleDeleteSession(item.id);
          }}
          overshootRight={false}
          friction={2}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm + 2,
              borderRadius: Radius.sm,
              marginBottom: 1,
              ...(isActive && { backgroundColor: colors.sidebarActiveItem }),
            }}
            onPress={() => w.handleSessionPress(item)}
            activeOpacity={0.6}
            accessibilityLabel={`Chat: ${item.title || 'New chat'}`}
            accessibilityHint="Swipe left to delete"
          >
            {isActive && (
              <View
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  backgroundColor: colors.primary,
                  borderRadius: 1.5,
                  marginRight: Spacing.sm,
                }}
              />
            )}
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
    [w.selectedSessionId, colors, w.handleSessionPress, w.handleDeleteSession, renderDeleteAction],
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
          onPress={w.handleNewSession}
          disabled={!w.isInitialized}
          activeOpacity={0.7}
          accessibilityLabel="Start new chat"
        >
          <PenLine size={18} color={colors.sidebarText} opacity={w.isInitialized ? 1 : 0.4} />
          <Text
            color={colors.sidebarText}
            fontSize={FontSize.subheadline}
            fontWeight="500"
            opacity={w.isInitialized ? 1 : 0.4}
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
            backgroundColor: colors.sidebarInputBg,
            borderRadius: Radius.sm,
            paddingHorizontal: Spacing.sm + 2,
            fontSize: FontSize.footnote,
            color: colors.sidebarText,
          }}
          placeholder="Search chats..."
          placeholderTextColor={colors.sidebarTextSecondary}
          value={w.searchQuery}
          onChangeText={w.setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {w.searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => w.setSearchQuery('')}
            style={{ position: 'absolute', right: Spacing.lg + Spacing.xs, padding: 4 }}
          >
            <X size={16} color={colors.sidebarTextSecondary} />
          </TouchableOpacity>
        )}
      </XStack>

      {/* Server selector — compact */}
      <YStack paddingHorizontal={Spacing.md} gap={Spacing.xs}>
        {w.servers.length === 0 ? (
          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.sidebarSeparator,
              borderRadius: Radius.sm,
              paddingVertical: Spacing.md,
              alignItems: 'center',
            }}
            onPress={() => w.navigateToQuickSetup()}
          >
            <Text color={colors.sidebarTextSecondary} fontSize={FontSize.footnote}>
              + Quick Setup
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {w.servers.map(server => {
              const isSelected = server.id === w.selectedServerId;
              const isAIProvider = server.serverType === ServerType.AIProvider;
              let ProviderIcon: React.ComponentType<any> | null = null;
              if (isAIProvider && server.aiProviderConfig?.providerType) {
                try { ProviderIcon = getProviderInfo(server.aiProviderConfig.providerType).icon; } catch { /* unknown provider */ }
              } else if (server.serverType === ServerType.CopilotCLI) {
                ProviderIcon = Github;
              } else if (server.serverType === ServerType.Codex) {
                ProviderIcon = Terminal;
              } else if (server.serverType === ServerType.ACP) {
                ProviderIcon = Server;
              }
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
                    ...(isSelected && { backgroundColor: colors.sidebarSelectedItem }),
                  }}
                  onPress={() => w.handleServerPress(server.id)}
                  onLongPress={() => w.handleServerLongPress(server)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Server: ${server.name || server.host}`}
                  accessibilityRole="button"
                  accessibilityHint="Tap to select, long press to edit or delete"
                >
                  {ProviderIcon && (
                    <ProviderIcon size={14} color={isSelected ? colors.sidebarText : colors.sidebarTextSecondary} style={{ marginRight: 4 }} />
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
                    <ConnectionBadge state={w.connectionState} isInitialized={w.isInitialized} />
                  )}
                </TouchableOpacity>
              );
            })}

            {w.selectedServer && w.selectedServer.serverType !== ServerType.AIProvider && (
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
                    backgroundColor: w.isConnected ? colors.destructive : colors.primary,
                  }}
                  onPress={w.handleConnect}
                >
                  <Text color={colors.contrastText} fontSize={FontSize.caption} fontWeight="600">
                    {w.isConnected ? 'Disconnect' : 'Connect'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => w.navigateToQuickSetup()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Add server"
                  accessibilityRole="button"
                >
                  <Plus size={18} color={colors.sidebarTextSecondary} />
                </TouchableOpacity>
              </XStack>
            )}

            {w.selectedServer && w.selectedServer.serverType === ServerType.AIProvider && (
              <XStack
                alignItems="center"
                gap={Spacing.sm}
                paddingHorizontal={Spacing.md}
                marginTop={Spacing.xs}
              >
                <XStack alignItems="center" gap={4} flex={1}>
                  <Check size={13} color={colors.primary} />
                  <Text color={colors.primary} fontSize={FontSize.caption} fontWeight="600">
                    Ready
                  </Text>
                </XStack>
                <TouchableOpacity
                  onPress={() => w.navigateToQuickSetup()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Add server"
                  accessibilityRole="button"
                >
                  <Plus size={18} color={colors.sidebarTextSecondary} />
                </TouchableOpacity>
              </XStack>
            )}

            {w.agentInfo && (
              <Text
                color={colors.sidebarTextSecondary}
                fontSize={FontSize.caption}
                paddingHorizontal={Spacing.md}
                numberOfLines={1}
              >
                {w.agentInfo.name}
              </Text>
            )}

            {/* MCP tools indicator */}
            {w.mcpSummary.totalTools > 0 && (
              <Text
                color={colors.primary}
                fontSize={FontSize.caption}
                paddingHorizontal={Spacing.md}
                marginTop={2}
              >
                🔌 {w.mcpSummary.totalTools} MCP tool{w.mcpSummary.totalTools !== 1 ? 's' : ''} from {w.mcpSummary.serverCount} server{w.mcpSummary.serverCount !== 1 ? 's' : ''}
              </Text>
            )}
          </>
        )}

        {w.connectionError && (
          <Text
            color={colors.destructive}
            fontSize={FontSize.caption}
            paddingHorizontal={Spacing.md}
            numberOfLines={2}
          >
            {w.connectionError}
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
        data={w.filteredSessions}
        keyExtractor={item => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={
          w.filteredSessions.length === 0
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
            {w.isInitialized ? 'No chats yet' : 'Connect to start'}
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={w.loadSessions} tintColor={colors.sidebarText} />
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
          onPress={() => w.navigateToSettings()}
        >
          <Settings size={20} color={colors.sidebarText} />
        </TouchableOpacity>
      </XStack>
    </YStack>
  );
}
