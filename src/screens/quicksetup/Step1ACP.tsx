/**
 * Step1ACP — ACP/Codex server configuration step.
 * Includes ping test and network scan for bridge discovery.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, Check, Wifi, Search, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';
import { pingHost, scanSubnet, getCommonSubnets, type DiscoveredHost } from '../../utils/networkDiscovery';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step1ACPProps {
  w: WizardState;
  colors: ThemeColors;
}

type PingState = 'idle' | 'testing' | 'ok' | 'fail';

export function Step1ACP({ w, colors }: Step1ACPProps) {
  const [pingState, setPingState] = useState<PingState>('idle');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredHost[]>([]);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handlePing = useCallback(async () => {
    const hostStr = w.acpHost.trim();
    if (!hostStr) return;
    setPingState('testing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const [host, portStr] = hostStr.includes(':') ? hostStr.split(':') : [hostStr, '8765'];
    const latency = await pingHost(host, parseInt(portStr, 10) || 8765);
    if (!mountedRef.current) return;
    if (latency !== null) {
      setPingState('ok');
      setPingLatency(latency);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPingState('fail');
      setPingLatency(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [w.acpHost]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setDiscovered([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const subnets = getCommonSubnets();
    const all: DiscoveredHost[] = [];
    for (const subnet of subnets) {
      const found = await scanSubnet(subnet, [8765, 4500], host => {
        if (!mountedRef.current) return;
        all.push(host);
        setDiscovered([...all]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
      if (found.length > 0) break;
    }
    if (mountedRef.current) setScanning(false);
  }, []);

  const selectDiscovered = useCallback((h: DiscoveredHost) => {
    w.setAcpHost(`${h.host}:${h.port}`);
    Haptics.selectionAsync();
  }, [w]);

  return (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          {w.selectedACP?.label}
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          Configura la connessione al server
        </Text>
      </YStack>

      <YStack gap={Spacing.md}>
        {/* Name */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Nome</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator, fontFamily: undefined }]}
            placeholder={w.selectedACP?.label ?? 'My Agent'}
            placeholderTextColor={colors.textTertiary}
            value={w.acpName}
            onChangeText={w.setAcpName}
            autoCapitalize="none"
          />
        </YStack>

        {/* Scheme toggle */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Protocollo</Text>
          <XStack gap={Spacing.sm}>
            {(['ws', 'wss', 'tcp'] as const).map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.schemeChip,
                  {
                    backgroundColor: w.acpScheme === s ? colors.primary : colors.cardBackground,
                    borderColor: w.acpScheme === s ? colors.primary : colors.separator,
                  },
                ]}
                onPress={() => { Haptics.selectionAsync(); w.setAcpScheme(s); }}
              >
                <Text
                  fontSize={FontSize.footnote}
                  fontWeight="600"
                  color={w.acpScheme === s ? colors.contrastText : colors.text}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {/* Host + Ping */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Host</Text>
          <XStack gap={Spacing.sm} alignItems="center">
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator, flex: 1 }]}
              placeholder="192.168.1.10:8765"
              placeholderTextColor={colors.textTertiary}
              value={w.acpHost}
              onChangeText={(t) => { w.setAcpHost(t); setPingState('idle'); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.pingButton,
                {
                  backgroundColor: pingState === 'ok' ? '#10B981' : pingState === 'fail' ? colors.destructive : colors.cardBackground,
                  borderColor: pingState === 'ok' ? '#10B981' : pingState === 'fail' ? colors.destructive : colors.separator,
                },
              ]}
              onPress={handlePing}
              disabled={pingState === 'testing' || !w.acpHost.trim()}
            >
              {pingState === 'testing' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : pingState === 'ok' ? (
                <Zap size={16} color="#fff" />
              ) : (
                <Wifi size={16} color={pingState === 'fail' ? '#fff' : colors.textSecondary} />
              )}
            </TouchableOpacity>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={11} color={colors.textTertiary}>
              IP locale, Tailscale, MeshNet — es. 100.64.x.x:8765
            </Text>
            {pingState === 'ok' && pingLatency !== null && (
              <Text fontSize={11} color="#10B981" fontWeight="600">
                {pingLatency}ms ✓
              </Text>
            )}
            {pingState === 'fail' && (
              <Text fontSize={11} color={colors.destructive} fontWeight="600">
                Non raggiungibile
              </Text>
            )}
          </XStack>
        </YStack>

        {/* Network Scan */}
        <YStack gap={Spacing.xs}>
          <TouchableOpacity
            style={[styles.scanButton, { borderColor: colors.separator }]}
            onPress={handleScan}
            disabled={scanning}
          >
            <XStack alignItems="center" gap={Spacing.xs}>
              {scanning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Search size={14} color={colors.primary} />
              )}
              <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="500">
                {scanning ? 'Scansione rete...' : 'Cerca bridge nella rete'}
              </Text>
            </XStack>
          </TouchableOpacity>

          {discovered.length > 0 && (
            <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
              {discovered.map(h => (
                <TouchableOpacity
                  key={`${h.host}:${h.port}`}
                  style={[styles.discoveredItem, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
                  onPress={() => selectDiscovered(h)}
                >
                  <XStack alignItems="center" gap={Spacing.sm} flex={1}>
                    <Zap size={12} color="#10B981" />
                    <Text fontSize={FontSize.footnote} color={colors.text} fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}>
                      {h.host}:{h.port}
                    </Text>
                  </XStack>
                  <Text fontSize={11} color={colors.textTertiary}>{h.latencyMs}ms</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </YStack>

        {/* Token (optional) */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Token (opzionale)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="Bearer token"
            placeholderTextColor={colors.textTertiary}
            value={w.acpToken}
            onChangeText={w.setAcpToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </YStack>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: w.saving ? 0.7 : (w.acpHost.trim() ? 1 : 0.4) }]}
        onPress={w.handleSaveACP}
        disabled={w.saving || !w.acpHost.trim()}
        activeOpacity={0.8}
      >
        {w.saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              {w.isEditing ? 'Salva modifiche' : 'Connetti'}
            </Text>
            <Check size={18} color={colors.contrastText} />
          </XStack>
        )}
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  schemeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pingButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  discoveredItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
