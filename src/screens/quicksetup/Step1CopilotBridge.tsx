/**
 * Step1CopilotBridge — Discovery and pairing step for Copilot SDK Bridge.
 * Three connection methods: mDNS auto-scan, QR code, manual URL+token.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, ChevronRight, Wifi, WifiOff, QrCode, Edit3, Zap, Github, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';
import { validateBridgeConnection } from '../../ai/copilot';
import { scanSubnet, getCommonSubnets, type DiscoveredHost } from '../../utils/networkDiscovery';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step1CopilotBridgeProps {
  w: WizardState;
  colors: ThemeColors;
}

type ConnectionMethod = 'scan' | 'qr' | 'manual';
type ScanState = 'idle' | 'scanning' | 'found' | 'notfound';
type ValidationState = 'idle' | 'validating' | 'ok' | 'fail';

export function Step1CopilotBridge({ w, colors }: Step1CopilotBridgeProps) {
  const [method, setMethod] = useState<ConnectionMethod>('scan');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [discovered, setDiscovered] = useState<DiscoveredHost[]>([]);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── Network scan for bridges on port 3030 ──
  const handleScan = useCallback(async () => {
    setScanState('scanning');
    setDiscovered([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const subnets = getCommonSubnets();
    const all: DiscoveredHost[] = [];
    for (const subnet of subnets) {
      const found = await scanSubnet(subnet, [3030, 3031], host => {
        if (!mountedRef.current) return;
        all.push(host);
        setDiscovered([...all]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
      if (found.length > 0) break;
    }
    if (mountedRef.current) {
      setScanState(all.length > 0 ? 'found' : 'notfound');
    }
  }, []);

  const selectDiscovered = useCallback((h: DiscoveredHost) => {
    const url = `ws://${h.host}:${h.port}`;
    w.setCopilotUrl(url);
    w.setCopilotHost(`${h.host}:${h.port}`);
    Haptics.selectionAsync();
    setValidationState('idle');
  }, [w]);

  // ── Validate connection ──
  const handleValidate = useCallback(async () => {
    const url = w.copilotUrl.trim();
    if (!url) return;
    setValidationState('validating');
    setValidationError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await validateBridgeConnection(url, w.copilotToken.trim() || undefined);
      if (!mountedRef.current) return;
      if (result.connected) {
        setValidationState('ok');
        if (result.bridgeVersion) setBridgeVersion(result.bridgeVersion);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setValidationState('fail');
        setValidationError(result.error ?? 'Connessione fallita');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setValidationState('fail');
      setValidationError((err as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [w.copilotUrl, w.copilotToken]);

  // ── Build URL from host ──
  const handleHostChange = useCallback((text: string) => {
    w.setCopilotHost(text);
    const clean = text.trim().replace(/^wss?:\/\//i, '').replace(/\/+$/, '');
    if (clean) {
      const tls = w.copilotTls;
      w.setCopilotUrl(`${tls ? 'wss' : 'ws'}://${clean}`);
    }
    setValidationState('idle');
  }, [w]);

  const toggleTls = useCallback(() => {
    const newTls = !w.copilotTls;
    w.setCopilotTls(newTls);
    const host = w.copilotHost.trim().replace(/^wss?:\/\//i, '').replace(/\/+$/, '');
    if (host) {
      w.setCopilotUrl(`${newTls ? 'wss' : 'ws'}://${host}`);
    }
    setValidationState('idle');
    Haptics.selectionAsync();
  }, [w]);

  const canProceed = validationState === 'ok';

  return (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Github size={32} color={colors.primary} />
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          Copilot SDK Bridge
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary} textAlign="center">
          Connettiti al bridge in esecuzione sul tuo computer
        </Text>
      </YStack>

      {/* Method selector tabs */}
      <XStack gap={Spacing.sm}>
        {([
          { key: 'scan' as const, icon: Wifi, label: 'Auto-Scan' },
          { key: 'qr' as const, icon: QrCode, label: 'QR Code' },
          { key: 'manual' as const, icon: Edit3, label: 'Manuale' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.methodTab,
              {
                backgroundColor: method === tab.key ? colors.primary : colors.cardBackground,
                borderColor: method === tab.key ? colors.primary : colors.separator,
                flex: 1,
              },
            ]}
            onPress={() => { setMethod(tab.key); Haptics.selectionAsync(); }}
          >
            <tab.icon size={14} color={method === tab.key ? colors.contrastText : colors.textSecondary} />
            <Text
              fontSize={11}
              fontWeight="600"
              color={method === tab.key ? colors.contrastText : colors.textSecondary}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </XStack>

      {/* ── Auto-Scan ── */}
      {method === 'scan' && (
        <YStack gap={Spacing.md}>
          <TouchableOpacity
            style={[styles.scanButton, { borderColor: colors.separator }]}
            onPress={handleScan}
            disabled={scanState === 'scanning'}
          >
            <XStack alignItems="center" gap={Spacing.xs}>
              {scanState === 'scanning' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RefreshCw size={14} color={colors.primary} />
              )}
              <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="500">
                {scanState === 'scanning' ? 'Scansione rete...' : scanState === 'notfound' ? 'Nessun bridge trovato — Riprova' : 'Cerca bridge nella rete locale'}
              </Text>
            </XStack>
          </TouchableOpacity>

          {discovered.length > 0 && (
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {discovered.map(h => (
                <TouchableOpacity
                  key={`${h.host}:${h.port}`}
                  style={[
                    styles.discoveredItem,
                    {
                      backgroundColor: w.copilotHost === `${h.host}:${h.port}` ? `${colors.primary}15` : colors.cardBackground,
                      borderColor: w.copilotHost === `${h.host}:${h.port}` ? colors.primary : colors.separator,
                    },
                  ]}
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
      )}

      {/* ── QR Code ── */}
      {method === 'qr' && (
        <YStack gap={Spacing.md} alignItems="center">
          <YStack
            padding={Spacing.xl}
            borderRadius={Radius.lg}
            backgroundColor={colors.cardBackground}
            borderWidth={StyleSheet.hairlineWidth}
            borderColor={colors.separator}
            alignItems="center"
            gap={Spacing.md}
          >
            <QrCode size={48} color={colors.textTertiary} />
            <Text fontSize={FontSize.footnote} color={colors.textTertiary} textAlign="center">
              Apri{'\n'}http://&lt;bridge-ip&gt;:3031/pairing/qr{'\n'}sul tuo browser e scansiona il QR code
            </Text>
            <Text fontSize={11} color={colors.textTertiary}>
              (Scanner QR in arrivo — usa Manuale per ora)
            </Text>
          </YStack>
        </YStack>
      )}

      {/* ── Manual entry ── */}
      {method === 'manual' && (
        <YStack gap={Spacing.md}>
          {/* TLS toggle */}
          <XStack alignItems="center" gap={Spacing.sm}>
            <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Protocollo</Text>
            <XStack gap={Spacing.xs}>
              {([false, true] as const).map(tls => (
                <TouchableOpacity
                  key={String(tls)}
                  style={[
                    styles.schemeChip,
                    {
                      backgroundColor: w.copilotTls === tls ? colors.primary : colors.cardBackground,
                      borderColor: w.copilotTls === tls ? colors.primary : colors.separator,
                    },
                  ]}
                  onPress={toggleTls}
                >
                  <Text
                    fontSize={FontSize.footnote}
                    fontWeight="600"
                    color={w.copilotTls === tls ? colors.contrastText : colors.text}
                  >
                    {tls ? 'WSS' : 'WS'}
                  </Text>
                </TouchableOpacity>
              ))}
            </XStack>
          </XStack>

          {/* Host input */}
          <YStack gap={Spacing.xs}>
            <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Host:Porta</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
              placeholder="192.168.68.55:3030"
              placeholderTextColor={colors.textTertiary}
              value={w.copilotHost}
              onChangeText={handleHostChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </YStack>

          {/* Token input */}
          <YStack gap={Spacing.xs}>
            <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Token (dal bridge)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
              placeholder="Incolla il token dal terminale"
              placeholderTextColor={colors.textTertiary}
              value={w.copilotToken}
              onChangeText={(t) => { w.setCopilotToken(t); setValidationState('idle'); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </YStack>
        </YStack>
      )}

      {/* URL preview (all methods) */}
      {w.copilotUrl.trim() !== '' && (
        <YStack
          padding={Spacing.sm}
          borderRadius={Radius.sm}
          backgroundColor={colors.cardBackground}
          borderWidth={StyleSheet.hairlineWidth}
          borderColor={colors.separator}
        >
          <Text fontSize={11} color={colors.textTertiary} fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}>
            {w.copilotUrl}
          </Text>
        </YStack>
      )}

      {/* Validate + status */}
      {w.copilotUrl.trim() !== '' && (
        <TouchableOpacity
          style={[
            styles.validateButton,
            {
              backgroundColor: validationState === 'ok' ? '#10B981' : validationState === 'fail' ? colors.destructive : colors.cardBackground,
              borderColor: validationState === 'ok' ? '#10B981' : validationState === 'fail' ? colors.destructive : colors.separator,
            },
          ]}
          onPress={handleValidate}
          disabled={validationState === 'validating'}
        >
          <XStack alignItems="center" gap={Spacing.xs}>
            {validationState === 'validating' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : validationState === 'ok' ? (
              <Zap size={16} color="#fff" />
            ) : validationState === 'fail' ? (
              <WifiOff size={16} color="#fff" />
            ) : (
              <Wifi size={16} color={colors.textSecondary} />
            )}
            <Text
              fontSize={FontSize.footnote}
              fontWeight="600"
              color={validationState === 'ok' || validationState === 'fail' ? '#fff' : colors.textSecondary}
            >
              {validationState === 'validating' ? 'Verifica...' : validationState === 'ok' ? `Connesso${bridgeVersion ? ` (v${bridgeVersion})` : ''}` : validationState === 'fail' ? 'Connessione fallita' : 'Testa connessione'}
            </Text>
          </XStack>
        </TouchableOpacity>
      )}

      {validationState === 'fail' && validationError && (
        <Text fontSize={11} color={colors.destructive}>{validationError}</Text>
      )}

      {/* Next button */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: canProceed ? 1 : 0.4 }]}
        onPress={() => { if (canProceed) w.goToCopilotModels(); }}
        disabled={!canProceed}
        activeOpacity={0.8}
      >
        <XStack alignItems="center" gap={Spacing.xs}>
          <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
            Scegli modello
          </Text>
          <ChevronRight size={18} color={colors.contrastText} />
        </XStack>
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
  methodTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scanButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
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
  validateButton: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
