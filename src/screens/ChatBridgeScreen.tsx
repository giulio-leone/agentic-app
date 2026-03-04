/**
 * ChatBridgeScreen — configure the Chat Bridge connection.
 */

import React, { useState, useCallback } from 'react';
import { TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { Server, CheckCircle, XCircle, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatBridge'>;

export default function ChatBridgeScreen({ route }: Props) {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(route.params?.url ?? 'ws://');
  const [token, setToken] = useState(route.params?.token ?? '');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const testConnection = useCallback(async () => {
    setTesting(true);
    setStatus('idle');
    try {
      const httpUrl = url.replace(/^ws/, 'http').replace(/\/$/, '');
      const res = await fetch(`${httpUrl}/health`);
      const data = await res.json();
      if (data?.status === 'ok') {
        setStatus('ok');
        Alert.alert('Connected', `Chat Bridge is running. Sessions: ${data.sessions ?? 0}`);
      } else {
        setStatus('error');
        Alert.alert('Error', 'Unexpected response from bridge');
      }
    } catch (err: unknown) {
      setStatus('error');
      Alert.alert('Error', `Could not connect: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  }, [url]);

  return (
    <ScrollView flex={1} backgroundColor="$background" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <YStack padding={Spacing.lg} gap={Spacing.lg}>
        {/* Header */}
        <YStack gap={Spacing.xs}>
          <XStack alignItems="center" gap={Spacing.sm}>
            <Server size={24} color={colors.primary} />
            <Text fontSize={FontSize.title2} fontWeight="700" color="$color">Chat Bridge</Text>
          </XStack>
          <Text fontSize={FontSize.footnote} color="$textTertiary">
            Connect to a remote CLI agent via WebSocket. Start the bridge server on your machine with: npm run bridge
          </Text>
        </YStack>

        {/* Connection form */}
        <YStack borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.md} backgroundColor="$cardBackground">
          <Text fontSize={FontSize.headline} fontWeight="600" color="$color">Connection</Text>

          <YStack gap={Spacing.xs}>
            <Text fontSize={FontSize.footnote} color="$textSecondary">WebSocket URL</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="ws://192.168.1.100:3111"
              placeholderTextColor={colors.tertiaryLabel}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 8,
                padding: 12,
                fontSize: 15,
                color: colors.text,
                backgroundColor: colors.background,
              }}
            />
          </YStack>

          <YStack gap={Spacing.xs}>
            <Text fontSize={FontSize.footnote} color="$textSecondary">Auth Token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="bridge auth token"
              placeholderTextColor={colors.tertiaryLabel}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 8,
                padding: 12,
                fontSize: 15,
                color: colors.text,
                backgroundColor: colors.background,
              }}
            />
          </YStack>

          <TouchableOpacity
            onPress={testConnection}
            disabled={testing || !url}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 8,
              padding: 14,
              alignItems: 'center',
              opacity: testing || !url ? 0.5 : 1,
            }}
          >
            <XStack alignItems="center" gap={Spacing.xs}>
              {testing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : status === 'ok' ? (
                <CheckCircle size={18} color="#fff" />
              ) : status === 'error' ? (
                <XCircle size={18} color="#fff" />
              ) : (
                <Wifi size={18} color="#fff" />
              )}
              <Text color="#fff" fontWeight="600" fontSize={FontSize.body}>
                {testing ? 'Testing…' : 'Test Connection'}
              </Text>
            </XStack>
          </TouchableOpacity>
        </YStack>

        {/* Info */}
        <YStack borderRadius={Radius.lg} padding={Spacing.lg} gap={Spacing.sm} backgroundColor="$cardBackground">
          <Text fontSize={FontSize.headline} fontWeight="600" color="$color">How it works</Text>
          <Text fontSize={FontSize.footnote} color="$textSecondary" lineHeight={20}>
            The Chat Bridge runs on your machine and spawns CLI agents (Claude Code, Copilot CLI, Codex) in tmux sessions.{'\n\n'}
            Output is captured and streamed as chat-style messages over WebSocket to this app.{'\n\n'}
            Supports Tailscale and NordVPN Meshnet for remote access.
          </Text>
        </YStack>
      </YStack>
    </ScrollView>
  );
}
