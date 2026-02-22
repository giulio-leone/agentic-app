/**
 * AddMCPServerForm — form to add a new MCP server with auth configuration.
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { MCPAuthType } from '../../mcp/types';
import type { MCPServerConfig } from '../../mcp/types';

interface AddMCPServerFormProps {
  colors: ThemeColors;
  onAdd: (config: Omit<MCPServerConfig, 'id'>) => Promise<void>;
  onCancel: () => void;
}

const AUTH_TYPES: { type: MCPAuthType; label: string }[] = [
  { type: MCPAuthType.None, label: 'None' },
  { type: MCPAuthType.Bearer, label: 'Bearer Token' },
  { type: MCPAuthType.ApiKey, label: 'API Key Header' },
];

export function AddMCPServerForm({ colors, onAdd, onCancel }: AddMCPServerFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<MCPAuthType>(MCPAuthType.None);
  const [token, setToken] = useState('');
  const [headerName, setHeaderName] = useState('X-API-Key');
  const [apiKey, setApiKey] = useState('');
  const [autoConnect, setAutoConnect] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const inputStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: colors.text,
    borderColor: colors.separator,
    backgroundColor: colors.systemGray6,
  };

  return (
    <YStack borderWidth={StyleSheet.hairlineWidth} borderColor="$separator" borderRadius={Radius.sm} padding={Spacing.md} gap={Spacing.sm}>
      <TextInput
        style={inputStyle}
        placeholder="Server name (e.g., GitHub MCP)"
        placeholderTextColor={colors.textTertiary}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={inputStyle}
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
        {AUTH_TYPES.map((at) => (
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
          style={inputStyle}
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
            style={inputStyle}
            placeholder="Header name (default: X-API-Key)"
            placeholderTextColor={colors.textTertiary}
            value={headerName}
            onChangeText={setHeaderName}
            autoCapitalize="none"
          />
          <TextInput
            style={inputStyle}
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
