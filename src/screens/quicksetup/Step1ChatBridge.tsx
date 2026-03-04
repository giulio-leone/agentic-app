/**
 * Step1ChatBridge — Chat Bridge connection setup (WS URL + auth token).
 */

import React, { useState } from 'react';
import { TouchableOpacity, TextInput, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronRight, Server, Wifi, WifiOff, Lock } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Props {
  w: WizardState;
  colors: ThemeColors;
}

export function Step1ChatBridge({ w, colors }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const scheme = w.bridgeTls ? 'https' : 'http';
      const host = w.bridgeUrl.trim();
      const url = `${scheme}://${host}/health`;
      console.log('[ChatBridge] Testing connection:', url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      console.log('[ChatBridge] Health response:', JSON.stringify(data));
      setTestResult(data.status === 'ok' ? 'ok' : 'fail');
    } catch (err: any) {
      console.error('[ChatBridge] Connection test failed:', err?.message || err);
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <YStack flex={1} padding={Spacing.lg} gap={Spacing.md}>
      <YStack gap={Spacing.xs}>
        <XStack alignItems="center" gap={Spacing.sm}>
          <Server size={24} color={colors.primary} />
          <Text fontSize={FontSize.title2} fontWeight="700" color="$color">Chat Bridge</Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color="$textSecondary">
          Connettiti al bridge server che esegue i CLI agent (Claude Code, Copilot, Codex).
        </Text>
      </YStack>

      {/* Host:Port */}
      <YStack gap={4}>
        <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary}>
          HOST:PORT
        </Text>
        <TextInput
          value={w.bridgeUrl}
          onChangeText={w.setBridgeUrl}
          placeholder="es. 192.168.1.100:3111 (usa IP LAN, non localhost)"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.cardBackground }]}
        />
        <Text fontSize={11} color={colors.textTertiary}>
          💡 Usa l'IP del PC (non localhost). Il bridge mostra l'IP all'avvio.
        </Text>
      </YStack>

      {/* Auth Token */}
      <YStack gap={4}>
        <XStack alignItems="center" gap={4}>
          <Lock size={12} color={colors.textTertiary} />
          <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary}>
            TOKEN (opzionale)
          </Text>
        </XStack>
        <TextInput
          value={w.bridgeToken}
          onChangeText={w.setBridgeToken}
          placeholder="Token di autenticazione"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.input, { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.cardBackground }]}
        />
      </YStack>

      {/* TLS toggle */}
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={FontSize.subheadline} color={colors.text}>TLS (wss://)</Text>
        <Switch
          value={w.bridgeTls}
          onValueChange={w.setBridgeTls}
          trackColor={{ false: colors.separator, true: colors.primary }}
        />
      </XStack>

      {/* Test connection */}
      <TouchableOpacity
        onPress={testConnection}
        disabled={testing || !w.bridgeUrl.trim()}
        style={[styles.testBtn, { borderColor: colors.separator, opacity: w.bridgeUrl.trim() ? 1 : 0.4 }]}
      >
        <XStack alignItems="center" gap={Spacing.xs}>
          {testing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : testResult === 'ok' ? (
            <Wifi size={16} color="#34C759" />
          ) : testResult === 'fail' ? (
            <WifiOff size={16} color="#FF3B30" />
          ) : (
            <Wifi size={16} color={colors.textTertiary} />
          )}
          <Text fontSize={FontSize.subheadline} color={colors.text}>
            {testing ? 'Testing...' : testResult === 'ok' ? 'Connesso ✓' : testResult === 'fail' ? 'Connessione fallita' : 'Testa connessione'}
          </Text>
        </XStack>
      </TouchableOpacity>

      {/* Continue */}
      <TouchableOpacity
        onPress={() => w.goToChatBridgeModels()}
        disabled={!w.bridgeUrl.trim()}
        style={[styles.continueBtn, { backgroundColor: colors.primary, opacity: w.bridgeUrl.trim() ? 1 : 0.4 }]}
      >
        <XStack alignItems="center" gap={Spacing.xs}>
          <Text color="#fff" fontWeight="600">Avanti</Text>
          <ChevronRight size={18} color="#fff" />
        </XStack>
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.body,
  },
  testBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  continueBtn: {
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
  },
});

export default Step1ChatBridge;
