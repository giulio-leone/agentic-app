/**
 * Settings screen — iOS Settings-style grouped cards.
 * Uses Tamagui styled components for layout and text.
 */

import React, { useState, useEffect } from 'react';
import {
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { Palette, Smartphone, Sun, Moon, Wrench, XCircle } from 'lucide-react-native';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius, type ThemeColors } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';
import { MCPAuthType, MCPConnectionState } from '../mcp/types';
import type { MCPServerConfig } from '../mcp/types';
import {
  useDevMode, useDeveloperLogs, useYoloMode, useAutoStartVisionDetect,
  useThemeMode, useMCPServers, useMCPStatuses,
  useSettingsActions, useMCPActions,
} from '../stores/selectors';

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

// ─── MCP Server Row ────────────────────────────────────────────────────────

function MCPServerRow({
  server,
  status,
  colors,
  onConnect,
  onDisconnect,
  onRemove,
}: {
  server: MCPServerConfig;
  status: { state: string; toolCount: number; resourceCount: number; error?: string } | undefined;
  colors: ThemeColors;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}) {
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
            style={{ borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}
            onPress={onDisconnect}
            accessibilityLabel={`Disconnect from ${server.name}`}
          >
            <Text fontSize={13} color="$textSecondary">Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{ borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, backgroundColor: colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}
            onPress={onConnect}
            disabled={isConnecting}
            accessibilityLabel={`Connect to ${server.name}`}
          >
            <Text fontSize={13} fontWeight="600" color="$contrastText">Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={{ borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.destructive, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}
          onPress={onRemove}
          accessibilityLabel={`Remove ${server.name}`}
        >
          <Text fontSize={13} color={colors.destructive}>Remove</Text>
        </TouchableOpacity>
      </XStack>
    </YStack>
  );
}

// ─── Add MCP Server Form ──────────────────────────────────────────────────

function AddMCPServerForm({
  colors,
  onAdd,
  onCancel,
}: {
  colors: ThemeColors;
  onAdd: (config: Omit<MCPServerConfig, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<MCPAuthType>(MCPAuthType.None);
  const [token, setToken] = useState('');
  const [headerName, setHeaderName] = useState('X-API-Key');
  const [apiKey, setApiKey] = useState('');
  const [autoConnect, setAutoConnect] = useState(true);
  const [saving, setSaving] = useState(false);

  const authTypes: { type: MCPAuthType; label: string }[] = [
    { type: MCPAuthType.None, label: 'None' },
    { type: MCPAuthType.Bearer, label: 'Bearer Token' },
    { type: MCPAuthType.ApiKey, label: 'API Key Header' },
  ];

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      Alert.alert('Error', 'Name and URL are required');
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        url: url.trim(),
        auth: {
          type: authType,
          ...(authType === MCPAuthType.Bearer ? { token } : {}),
          ...(authType === MCPAuthType.ApiKey ? { headerName, apiKey } : {}),
        },
        autoConnect,
        enabled: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <YStack borderWidth={StyleSheet.hairlineWidth} borderColor="$separator" borderRadius={Radius.sm} padding={Spacing.md} gap={Spacing.sm}>
      <TextInput
        style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }}
        placeholder="Server name (e.g., GitHub MCP)"
        placeholderTextColor={colors.textTertiary}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }}
        placeholder="URL (e.g., https://mcp.example.com/mcp)"
        placeholderTextColor={colors.textTertiary}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        keyboardType="url"
      />

      {/* Auth Type Selector */}
      <Text fontSize={13} fontWeight="500" marginTop={4} color="$textSecondary">Authentication</Text>
      <XStack gap={4}>
        {authTypes.map((at) => (
          <TouchableOpacity
            key={at.type}
            style={{
              borderRadius: 14,
              borderWidth: StyleSheet.hairlineWidth,
              paddingHorizontal: Spacing.md,
              paddingVertical: 5,
              backgroundColor: authType === at.type ? colors.primary : colors.systemGray5,
              borderColor: authType === at.type ? colors.primary : colors.separator,
            }}
            onPress={() => setAuthType(at.type)}
          >
            <Text fontSize={13} color={authType === at.type ? '$contrastText' : '$color'}>
              {at.label}
            </Text>
          </TouchableOpacity>
        ))}
      </XStack>

      {authType === MCPAuthType.Bearer && (
        <TextInput
          style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }}
          placeholder="Bearer token"
          placeholderTextColor={colors.textTertiary}
          value={token}
          onChangeText={setToken}
          secureTextEntry
          autoCapitalize="none"
        />
      )}

      {authType === MCPAuthType.ApiKey && (
        <>
          <TextInput
            style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }}
            placeholder="Header name (default: X-API-Key)"
            placeholderTextColor={colors.textTertiary}
            value={headerName}
            onChangeText={setHeaderName}
            autoCapitalize="none"
          />
          <TextInput
            style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 16, color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }}
            placeholder="API key value"
            placeholderTextColor={colors.textTertiary}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
          />
        </>
      )}

      {/* Auto-connect toggle */}
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={13} fontWeight="500" color="$textSecondary">Auto-connect on startup</Text>
        <Switch
          value={autoConnect}
          onValueChange={setAutoConnect}
          trackColor={{ true: colors.primary, false: colors.systemGray4 }}
          thumbColor={colors.contrastText}
          accessibilityLabel="Auto-connect on startup"
        />
      </XStack>

      {/* Actions */}
      <XStack justifyContent="flex-end" gap={Spacing.sm} marginTop={Spacing.sm}>
        <TouchableOpacity
          style={{ borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: Spacing.sm, borderColor: colors.separator }}
          onPress={onCancel}
          accessibilityLabel="Cancel adding MCP server"
        >
          <Text color="$textSecondary">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: Spacing.sm, borderColor: 'transparent', backgroundColor: colors.primary }}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Add and connect MCP server"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.contrastText} />
          ) : (
            <Text fontWeight="600" color="$contrastText">Add & Connect</Text>
          )}
        </TouchableOpacity>
      </XStack>
    </YStack>
  );
}
