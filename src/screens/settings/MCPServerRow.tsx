/**
 * MCPServerRow — single MCP server status card with connect/disconnect/remove actions.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Wrench, XCircle } from 'lucide-react-native';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { MCPConnectionState } from '../../mcp/types';
import type { MCPServerConfig } from '../../mcp/types';

interface MCPServerRowProps {
  server: MCPServerConfig;
  status: { state: string; toolCount: number; resourceCount: number; error?: string } | undefined;
  colors: ThemeColors;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}

const styles = StyleSheet.create({
  btnBase: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
});

export const MCPServerRow = React.memo(function MCPServerRow({ server, status, colors, onConnect, onDisconnect, onRemove }: MCPServerRowProps) {
  const isConnected = status?.state === MCPConnectionState.Connected;
  const isConnecting = status?.state === MCPConnectionState.Connecting;
  const hasError = status?.state === MCPConnectionState.Error;

  return (
    <YStack borderWidth={StyleSheet.hairlineWidth} borderColor="$separator" borderRadius={Radius.sm} padding={Spacing.md} gap={Spacing.sm}>
      <XStack alignItems="center" gap={Spacing.sm}>
        <YStack flex={1}>
          <Text fontSize={16} fontWeight="500" color="$color">{server.name}</Text>
          <Text fontSize={12} marginTop={2} color="$textTertiary" numberOfLines={1}>
            {server.url}
          </Text>
        </YStack>
        <XStack alignItems="center" gap={4}>
          {isConnected && (
            <XStack borderRadius={10} paddingHorizontal={8} paddingVertical={3} backgroundColor={colors.primary + '20'} alignItems="center" gap={4}>
              <Wrench size={11} color={colors.primary} />
              <Text fontSize={11} fontWeight="600" color="$primary">
                {status?.toolCount ?? 0} tools
              </Text>
            </XStack>
          )}
          {isConnecting && <ActivityIndicator size="small" color={colors.primary} />}
          {hasError && (
            <XStack alignItems="center" gap={4}>
              <XCircle size={12} color={colors.destructive} />
              <Text color={colors.destructive} fontSize={12}>Error</Text>
            </XStack>
          )}
        </XStack>
      </XStack>

      {hasError && status?.error && (
        <Text fontSize={12} color={colors.destructive} numberOfLines={2}>
          {status.error}
        </Text>
      )}

      <XStack gap={Spacing.sm}>
        {isConnected ? (
          <TouchableOpacity
            style={[styles.btnBase, { borderColor: colors.separator }]}
            onPress={onDisconnect}
            accessibilityLabel={`Disconnect from ${server.name}`}
          >
            <Text fontSize={13} color="$textSecondary">Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnBase, { backgroundColor: colors.primary }]}
            onPress={onConnect}
            disabled={isConnecting}
            accessibilityLabel={`Connect to ${server.name}`}
          >
            <Text fontSize={13} fontWeight="600" color="$contrastText">Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.btnBase, { borderColor: colors.destructive }]}
          onPress={onRemove}
          accessibilityLabel={`Remove ${server.name}`}
        >
          <Text fontSize={13} color={colors.destructive}>Remove</Text>
        </TouchableOpacity>
      </XStack>
    </YStack>
  );
});
