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
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { Palette, Smartphone, Sun, Moon, Eclipse, Check, Type, Vibrate, Trash2, TerminalSquare } from 'lucide-react-native';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius, AccentColors, type AccentColorKey } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';
import {
  useDevMode, useDeveloperLogs, useYoloMode, useAutoStartVisionDetect,
  useThemeMode, useAccentColor, useFontScale, useHapticsEnabled, useTerminalEngine,
  useMCPServers, useMCPStatuses,
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
  const accentColor = useAccentColor();
  const fontScale = useFontScale();
  const hapticsEnabled = useHapticsEnabled();
  const terminalEngine = useTerminalEngine();
  const mcpServers = useMCPServers();
  const mcpStatuses = useMCPStatuses();

  const { toggleDevMode, toggleYoloMode, toggleAutoStartVisionDetect, setThemeMode, setAccentColor, setFontScale, setHapticsEnabled, clearAppCache, setTerminalEngine, clearLogs } = useSettingsActions();
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

        {/* Theme Mode */}
        <Text fontSize={12} marginTop={2} color="$textTertiary">
          Theme
        </Text>
        <XStack gap={Spacing.xs} flexWrap="wrap">
          {([
            { key: 'system', label: 'System', Icon: Smartphone },
            { key: 'light', label: 'Light', Icon: Sun },
            { key: 'dark', label: 'Dark', Icon: Moon },
            { key: 'amoled', label: 'AMOLED', Icon: Eclipse },
          ] as const).map(({ key, label, Icon }) => (
            <TouchableOpacity
              key={key}
              style={{
                flex: 1,
                minWidth: 70,
                borderRadius: Radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                paddingVertical: Spacing.sm,
                alignItems: 'center',
                backgroundColor: themeMode === key ? colors.primary : colors.systemGray5,
                borderColor: themeMode === key ? colors.primary : colors.separator,
              }}
              onPress={() => setThemeMode(key)}
              accessibilityLabel={`Theme: ${label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: themeMode === key }}
            >
              <XStack alignItems="center" justifyContent="center" gap={4}>
                <Icon size={14} color={themeMode === key ? colors.contrastText : colors.text} />
                <Text fontSize={12} fontWeight={themeMode === key ? '600' : '400'} color={themeMode === key ? '$contrastText' : '$color'}>
                  {label}
                </Text>
              </XStack>
            </TouchableOpacity>
          ))}
        </XStack>

        {/* Accent Color */}
        <Text fontSize={12} marginTop={Spacing.sm} color="$textTertiary">
          Accent Color
        </Text>
        <XStack gap={Spacing.sm} flexWrap="wrap">
          {(Object.keys(AccentColors) as AccentColorKey[]).map(key => (
            <TouchableOpacity
              key={key}
              onPress={() => setAccentColor(key)}
              accessibilityLabel={`Accent color: ${key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: accentColor === key }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: AccentColors[key],
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: accentColor === key ? 2 : 0,
                borderColor: colors.contrastText,
              }}
            >
              {accentColor === key && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
            </TouchableOpacity>
          ))}
        </XStack>
      </YStack>

      {/* Font Size */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack alignItems="center" gap={Spacing.sm}>
          <Type size={18} color={colors.text} />
          <Text fontSize={17} fontWeight="600" color="$color">Font Size</Text>
          <Text fontSize={13} color="$textTertiary" marginLeft="auto">{Math.round(fontScale * 100)}%</Text>
        </XStack>
        <Text fontSize={12} color="$textTertiary">
          Adjust text size across the app
        </Text>
        <XStack alignItems="center" gap={Spacing.sm}>
          <Text fontSize={11} color="$textTertiary">A</Text>
          <View style={{ flex: 1 }}>
            <Slider
              minimumValue={0.8}
              maximumValue={1.4}
              step={0.1}
              value={fontScale}
              onSlidingComplete={setFontScale}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.systemGray4}
              thumbTintColor={colors.primary}
            />
          </View>
          <Text fontSize={17} color="$textTertiary">A</Text>
        </XStack>
        <Text fontSize={14 * fontScale} color="$color" textAlign="center">
          Preview text at {Math.round(fontScale * 100)}%
        </Text>
      </YStack>

      {/* Haptics & Cache */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap={Spacing.sm} flex={1}>
            <Vibrate size={18} color={colors.text} />
            <YStack flex={1}>
              <Text fontSize={16} fontWeight="500" color="$color">Haptic Feedback</Text>
              <Text fontSize={12} marginTop={2} color="$textTertiary">
                Vibrate on interactions
              </Text>
            </YStack>
          </XStack>
          <Switch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            trackColor={{ true: colors.primary, false: colors.systemGray4 }}
            thumbColor={colors.contrastText}
            accessibilityLabel="Haptic feedback"
          />
        </XStack>
        <Separator borderColor="$separator" />
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Clear Cache', 'Delete all cached sessions and messages?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => clearAppCache() },
            ]);
          }}
          accessibilityLabel="Clear app cache"
          accessibilityRole="button"
        >
          <XStack alignItems="center" gap={Spacing.sm}>
            <Trash2 size={18} color={colors.destructive || '#FF3B30'} />
            <Text fontSize={16} color={colors.destructive || '#FF3B30'}>Clear App Cache</Text>
          </XStack>
        </TouchableOpacity>
      </YStack>

      {/* Terminal Engine */}
      <YStack marginTop={Spacing.lg} marginHorizontal={Spacing.lg} borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
        <XStack alignItems="center" gap={Spacing.sm}>
          <TerminalSquare size={18} color={colors.text} />
          <Text fontSize={17} fontWeight="600" color="$color">Terminal Engine</Text>
        </XStack>
        <Text fontSize={12} color="$textTertiary">
          Choose the terminal emulator for the remote shell
        </Text>
        <XStack gap={Spacing.xs}>
          {([
            { key: 'xterm' as const, label: 'xterm.js', desc: 'Classic, stable' },
            { key: 'ghostty' as const, label: 'Ghostty', desc: 'WASM, better Unicode' },
          ]).map(({ key, label, desc }) => (
            <TouchableOpacity
              key={key}
              style={{
                flex: 1,
                borderRadius: Radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                paddingVertical: Spacing.sm,
                paddingHorizontal: Spacing.sm,
                backgroundColor: terminalEngine === key ? colors.primary : colors.systemGray5,
                borderColor: terminalEngine === key ? colors.primary : colors.separator,
              }}
              onPress={() => setTerminalEngine(key)}
              accessibilityLabel={`Terminal: ${label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: terminalEngine === key }}
            >
              <Text
                fontSize={13}
                fontWeight={terminalEngine === key ? '600' : '400'}
                color={terminalEngine === key ? '$contrastText' : '$color'}
                textAlign="center"
              >
                {label}
              </Text>
              <Text
                fontSize={10}
                color={terminalEngine === key ? '$contrastText' : '$textTertiary'}
                textAlign="center"
                marginTop={2}
              >
                {desc}
              </Text>
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
