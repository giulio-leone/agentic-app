/**
 * Settings screen — iOS Settings-style grouped cards.
 * Uses Tamagui styled components for layout and text.
 */

import React, { useState, useEffect } from 'react';
import {
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { Palette, Smartphone, Sun, Moon } from 'lucide-react-native';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';
import {
  useDevMode, useDeveloperLogs, useYoloMode, useAutoStartVisionDetect,
  useThemeMode, useMCPServers, useMCPStatuses,
  useSettingsActions, useMCPActions,
} from '../stores/selectors';
import { MCPServerRow } from './settings/MCPServerRow';
import { AddMCPServerForm } from './settings/AddMCPServerForm';

export function SettingsScreen() {
  const { colors } = useDesignSystem();

  const devModeEnabled = useDevMode();
  const developerLogs = useDeveloperLogs();
  const yoloModeEnabled = useYoloMode();
  const autoStartVisionDetect = useAutoStartVisionDetect();
  const themeMode = useThemeMode();
  const mcpServers = useMCPServers();
  const mcpStatuses = useMCPStatuses();

  const { toggleDevMode, toggleYoloMode, toggleAutoStartVisionDetect, setThemeMode, clearLogs } = useSettingsActions();
  const { loadMCPServers, addMCPServer, removeMCPServer, connectMCPServer, disconnectMCPServer } = useMCPActions();

  const [showAddMCP, setShowAddMCP] = useState(false);

  useEffect(() => {
    loadMCPServers();
  }, [loadMCPServers]);

  return (
    <ScrollView flex={1} backgroundColor="$background">
      {/* MCP Servers */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={17} fontWeight="600" color="$color">🔌 MCP Servers</Text>
          <TouchableOpacity onPress={() => setShowAddMCP(!showAddMCP)} accessibilityLabel={showAddMCP ? 'Cancel adding server' : 'Add MCP server'} accessibilityRole="button">
            <Text fontSize={13} fontWeight="600" color="$primary">
              {showAddMCP ? 'Cancel' : '+ Add'}
            </Text>
          </TouchableOpacity>
        </XStack>
        <Text fontSize={12} marginTop={2} color="$textTertiary">
          Connect to external MCP servers to give AI access to tools (GitHub, Stripe, databases, etc.)
        </Text>

        {showAddMCP && (
          <AddMCPServerForm
            colors={colors}
            onAdd={async (config) => {
              await addMCPServer(config);
              setShowAddMCP(false);
            }}
            onCancel={() => setShowAddMCP(false)}
          />
        )}

        {mcpServers.length === 0 && !showAddMCP && (
          <Text fontSize={13} fontStyle="italic" textAlign="center" paddingVertical={16} color="$textTertiary">
            No MCP servers configured
          </Text>
        )}

        {mcpServers.map((server) => {
          const status = mcpStatuses.find(s => s.serverId === server.id);
          return (
            <MCPServerRow
              key={server.id}
              server={server}
              status={status}
              colors={colors}
              onConnect={() => connectMCPServer(server.id)}
              onDisconnect={() => disconnectMCPServer(server.id)}
              onRemove={() => {
                Alert.alert('Remove Server', `Remove "${server.name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeMCPServer(server.id) },
                ]);
              }}
            />
          );
        })}
      </YStack>

      {/* Appearance */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack alignItems="center" gap={Spacing.sm}>
          <Palette size={18} color={colors.text} />
          <Text fontSize={17} fontWeight="600" color="$color">Appearance</Text>
        </XStack>
        <Text fontSize={12} marginTop={2} color="$textTertiary">
          Override system theme or follow device settings
        </Text>
        <XStack gap={Spacing.xs}>
          {(['system', 'light', 'dark'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={{
                flex: 1,
                borderRadius: Radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                paddingVertical: Spacing.sm,
                alignItems: 'center',
                backgroundColor: themeMode === mode ? colors.primary : colors.systemGray5,
                borderColor: themeMode === mode ? colors.primary : colors.separator,
              }}
              onPress={() => setThemeMode(mode)}
              accessibilityLabel={`Theme: ${mode}`}
              accessibilityRole="button"
              accessibilityState={{ selected: themeMode === mode }}
            >
              <XStack alignItems="center" justifyContent="center" gap={4}>
                {mode === 'system' ? <Smartphone size={14} color={themeMode === mode ? colors.contrastText : colors.text} /> :
                 mode === 'light' ? <Sun size={14} color={themeMode === mode ? colors.contrastText : colors.text} /> :
                 <Moon size={14} color={themeMode === mode ? colors.contrastText : colors.text} />}
                <Text fontSize={13} fontWeight={themeMode === mode ? '600' : '400'} color={themeMode === mode ? '$contrastText' : '$color'}>
                  {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
                </Text>
              </XStack>
            </TouchableOpacity>
          ))}
        </XStack>
      </YStack>

      {/* Dev Mode */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <Text fontSize={16} fontWeight="500" color="$color">Developer Mode</Text>
            <Text fontSize={12} marginTop={2} color="$textTertiary">
              Show raw JSON-RPC messages
            </Text>
          </YStack>
          <Switch
            value={devModeEnabled}
            onValueChange={toggleDevMode}
            trackColor={{ true: colors.primary, false: colors.systemGray4 }}
            thumbColor={colors.contrastText}
            accessibilityLabel="Developer mode"
          />
        </XStack>
      </YStack>

      {/* Auto-Start Vision Detect */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <Text fontSize={16} fontWeight="500" color="$color">Auto-Start Vision</Text>
            <Text fontSize={12} marginTop={2} paddingRight={Spacing.lg} color="$textTertiary">
              Automatically launch Screen Watcher on app startup.
            </Text>
          </YStack>
          <Switch
            value={autoStartVisionDetect}
            onValueChange={toggleAutoStartVisionDetect}
            trackColor={{ true: colors.primary, false: colors.systemGray4 }}
            thumbColor={colors.contrastText}
            accessibilityLabel="Auto-Start Vision Detect"
          />
        </XStack>
      </YStack>

      {/* YOLO Mode */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <Text fontSize={16} fontWeight="500" color="$color">YOLO Mode</Text>
            <Text fontSize={12} marginTop={2} paddingRight={Spacing.lg} color="$textTertiary">
              Auto-approve all agent tool executions (no prompts).
            </Text>
          </YStack>
          <Switch
            value={yoloModeEnabled}
            onValueChange={toggleYoloMode}
            trackColor={{ true: colors.destructive || colors.primary, false: colors.systemGray4 }}
            thumbColor={colors.contrastText}
            accessibilityLabel="YOLO Mode"
          />
        </XStack>
      </YStack>

      {/* Developer Logs */}
      {devModeEnabled && (
        <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={17} fontWeight="600" color="$color">Developer Logs</Text>
            <TouchableOpacity onPress={clearLogs} accessibilityLabel="Clear developer logs" accessibilityRole="button">
              <Text fontSize={13} fontWeight="600" color="$primary">Clear</Text>
            </TouchableOpacity>
          </XStack>
          <YStack maxHeight={300} borderRadius={Radius.sm} padding={Spacing.sm} backgroundColor="$codeBackground">
            {developerLogs.length === 0 ? (
              <Text fontSize={13} fontStyle="italic" textAlign="center" paddingVertical={16} color="$textTertiary">No logs yet</Text>
            ) : (
              developerLogs
                .slice()
                .reverse()
                .map((log, index) => (
                  <Text key={index} fontSize={11} fontFamily="monospace" paddingVertical={1} color="$codeText" selectable>
                    {log}
                  </Text>
                ))
            )}
          </YStack>
        </YStack>
      )}

      {/* About */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" paddingVertical={4}>
          <Text fontSize={16} color="$color">App</Text>
          <Text fontSize={16} color="$textTertiary">{APP_DISPLAY_NAME} v{APP_VERSION}</Text>
        </XStack>
        <Separator borderColor="$separator" />
        <XStack justifyContent="space-between" paddingVertical={4}>
          <Text fontSize={16} color="$color">Platform</Text>
          <Text fontSize={16} color="$textTertiary">React Native (Expo)</Text>
        </XStack>
      </YStack>
    </ScrollView>
  );
}
