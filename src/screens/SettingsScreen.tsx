/**
 * Settings screen — iOS Settings-style grouped cards.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../stores/appStore';
import { useTheme, FontSize, Spacing, Radius } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';
import { MCPAuthType, MCPConnectionState } from '../mcp/types';
import type { MCPServerConfig } from '../mcp/types';

export function SettingsScreen() {
  const { colors } = useTheme();
  const {
    devModeEnabled, toggleDevMode, developerLogs, clearLogs,
    mcpServers, mcpStatuses,
    loadMCPServers, addMCPServer, removeMCPServer,
    connectMCPServer, disconnectMCPServer,
  } = useAppStore();

  const [showAddMCP, setShowAddMCP] = useState(false);

  useEffect(() => {
    loadMCPServers();
  }, [loadMCPServers]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.systemGray6 }]}>
      {/* MCP Servers */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔌 MCP Servers</Text>
          <TouchableOpacity onPress={() => setShowAddMCP(!showAddMCP)}>
            <Text style={[styles.clearButton, { color: colors.primary }]}>
              {showAddMCP ? 'Cancel' : '+ Add'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.settingSubtitle, { color: colors.textTertiary }]}>
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
          <Text style={[styles.emptyLogs, { color: colors.textTertiary }]}>
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
      </View>

      {/* Dev Mode */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Developer Mode</Text>
            <Text style={[styles.settingSubtitle, { color: colors.textTertiary }]}>
              Show raw JSON-RPC messages
            </Text>
          </View>
          <Switch
            value={devModeEnabled}
            onValueChange={toggleDevMode}
            trackColor={{ true: colors.primary, false: colors.systemGray4 }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Developer mode"
          />
        </View>
      </View>

      {/* Developer Logs */}
      {devModeEnabled && (
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Developer Logs</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={[styles.clearButton, { color: colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.logsContainer, { backgroundColor: colors.codeBackground }]}>
            {developerLogs.length === 0 ? (
              <Text style={[styles.emptyLogs, { color: colors.textTertiary }]}>No logs yet</Text>
            ) : (
              developerLogs
                .slice()
                .reverse()
                .map((log, index) => (
                  <Text key={index} style={[styles.logEntry, { color: colors.codeText }]} selectable>
                    {log}
                  </Text>
                ))
            )}
          </View>
        </View>
      )}

      {/* About */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.text }]}>App</Text>
          <Text style={[styles.aboutValue, { color: colors.textTertiary }]}>{APP_DISPLAY_NAME} v{APP_VERSION}</Text>
        </View>
        <View style={[styles.aboutSeparator, { backgroundColor: colors.separator }]} />
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.text }]}>Platform</Text>
          <Text style={[styles.aboutValue, { color: colors.textTertiary }]}>React Native (Expo)</Text>
        </View>
      </View>
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
  colors: ReturnType<typeof useTheme>['colors'];
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}) {
  const isConnected = status?.state === MCPConnectionState.Connected;
  const isConnecting = status?.state === MCPConnectionState.Connecting;
  const hasError = status?.state === MCPConnectionState.Error;

  return (
    <View style={[styles.mcpRow, { borderColor: colors.separator }]}>
      <View style={styles.mcpRowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{server.name}</Text>
          <Text style={[styles.mcpUrl, { color: colors.textTertiary }]} numberOfLines={1}>
            {server.url}
          </Text>
        </View>
        <View style={styles.mcpBadges}>
          {isConnected && (
            <View style={[styles.mcpBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.mcpBadgeText, { color: colors.primary }]}>
                🔧 {status?.toolCount ?? 0} tools
              </Text>
            </View>
          )}
          {isConnecting && <ActivityIndicator size="small" color={colors.primary} />}
          {hasError && (
            <Text style={{ color: colors.destructive, fontSize: 12 }}>✗ Error</Text>
          )}
        </View>
      </View>

      {hasError && status?.error && (
        <Text style={[styles.mcpError, { color: colors.destructive }]} numberOfLines={2}>
          {status.error}
        </Text>
      )}

      <View style={styles.mcpActions}>
        {isConnected ? (
          <TouchableOpacity
            style={[styles.mcpActionBtn, { borderColor: colors.separator }]}
            onPress={onDisconnect}
            accessibilityLabel={`Disconnect from ${server.name}`}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.mcpActionBtn, { backgroundColor: colors.primary }]}
            onPress={onConnect}
            disabled={isConnecting}
            accessibilityLabel={`Connect to ${server.name}`}
          >
            <Text style={{ color: colors.contrastText, fontSize: 13, fontWeight: '600' }}>Connect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.mcpActionBtn, { borderColor: colors.destructive }]}
          onPress={onRemove}
          accessibilityLabel={`Remove ${server.name}`}
        >
          <Text style={{ color: colors.destructive, fontSize: 13 }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add MCP Server Form ──────────────────────────────────────────────────

function AddMCPServerForm({
  colors,
  onAdd,
  onCancel,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
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
    <View style={[styles.addMCPForm, { borderColor: colors.separator }]}>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }]}
        placeholder="Server name (e.g., GitHub MCP)"
        placeholderTextColor={colors.textTertiary}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }]}
        placeholder="URL (e.g., https://mcp.example.com/mcp)"
        placeholderTextColor={colors.textTertiary}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        keyboardType="url"
      />

      {/* Auth Type Selector */}
      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Authentication</Text>
      <View style={styles.authChips}>
        {authTypes.map((at) => (
          <TouchableOpacity
            key={at.type}
            style={[
              styles.authChip,
              {
                backgroundColor: authType === at.type ? colors.primary : colors.systemGray5,
                borderColor: authType === at.type ? colors.primary : colors.separator,
              },
            ]}
            onPress={() => setAuthType(at.type)}
          >
            <Text style={{ color: authType === at.type ? colors.contrastText : colors.text, fontSize: 13 }}>
              {at.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {authType === MCPAuthType.Bearer && (
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }]}
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
            style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }]}
            placeholder="Header name (default: X-API-Key)"
            placeholderTextColor={colors.textTertiary}
            value={headerName}
            onChangeText={setHeaderName}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: colors.systemGray6 }]}
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
      <View style={styles.settingRow}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Auto-connect on startup</Text>
        <Switch
          value={autoConnect}
          onValueChange={setAutoConnect}
          trackColor={{ true: colors.primary, false: colors.systemGray4 }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Auto-connect on startup"
        />
      </View>

      {/* Actions */}
      <View style={styles.formActions}>
        <TouchableOpacity
          style={[styles.formBtn, { borderColor: colors.separator }]}
          onPress={onCancel}
          accessibilityLabel="Cancel adding MCP server"
        >
          <Text style={{ color: colors.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.formBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Add and connect MCP server"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.contrastText} />
          ) : (
            <Text style={{ color: colors.contrastText, fontWeight: '600' }}>Add & Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.headline,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  clearButton: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 300,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  emptyLogs: {
    fontSize: FontSize.footnote,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  logEntry: {
    fontSize: 11,
    fontFamily: 'monospace',
    paddingVertical: 1,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  aboutSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  aboutLabel: {
    fontSize: FontSize.body,
  },
  aboutValue: {
    fontSize: FontSize.body,
  },
  // MCP styles
  mcpRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  mcpRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mcpUrl: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  mcpBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  mcpBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mcpBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mcpError: {
    fontSize: FontSize.caption,
  },
  mcpActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  mcpActionBtn: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addMCPForm: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  formLabel: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  authChips: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  authChip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  formBtn: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderColor: 'transparent',
  },
});
