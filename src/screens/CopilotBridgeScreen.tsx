/**
 * CopilotBridgeScreen — configure the Copilot bridge connection.
 * iOS Settings-style grouped cards with manual connection form,
 * connection method selector, test/connect buttons, and bridge info.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { Wifi, QrCode, Settings, CheckCircle, XCircle, Server } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { sharedStyles } from '../utils/sharedStyles';
import {
  CopilotBridgeService,
  validateBridgeConnection,
  loadBridgeConfig,
  saveBridgeConfig,
  type CopilotConnectionState,
  type CopilotBridgeConfig,
} from '../ai/copilot';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

// ── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'CopilotBridge'>;
type ConnectionMethod = 'auto' | 'qr' | 'manual';

interface BridgeInfo {
  version: string;
  sessions: number;
  maxSessions: number;
  models: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWsUrl(host: string, port: string, tls: boolean): string {
  const scheme = tls ? 'wss' : 'ws';
  return `${scheme}://${host}:${port}`;
}

function parseWsUrl(url: string): { host: string; port: string; tls: boolean } {
  try {
    const tls = url.startsWith('wss://');
    const stripped = url.replace(/^wss?:\/\//, '');
    const [host, port] = stripped.split(':');
    return { host: host || '', port: port || '3030', tls };
  } catch {
    return { host: '', port: '3030', tls: true };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CopilotBridgeScreen({ route }: Props) {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const bridge = CopilotBridgeService.getInstance();

  // ── State ──────────────────────────────────────────────────────────────────

  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('manual');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3030');
  const [token, setToken] = useState('');
  const [tls, setTls] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const [connectionState, setConnectionState] = useState<CopilotConnectionState>(bridge.connectionState);

  const isConnected = connectionState === 'connected' || connectionState === 'authenticated';
  const isAuthenticated = connectionState === 'authenticated';

  const inputStyle = useMemo(() => ({
    flex: 1,
    fontSize: FontSize.body,
    color: colors.text,
    textAlign: 'right' as const,
    paddingVertical: 0,
  }), [colors.text]);

  // ── Load saved config on mount ─────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const config = await loadBridgeConfig();
      if (config) {
        const parsed = parseWsUrl(config.url);
        setHost(parsed.host);
        setPort(parsed.port);
        setTls(parsed.tls);
        if (config.token) setToken(config.token);
      }
    })();
  }, []);

  // ── Pre-fill from deep link params ─────────────────────────────────────────

  useEffect(() => {
    const params = route.params;
    if (params?.url) {
      const parsed = parseWsUrl(params.url);
      setHost(parsed.host);
      setPort(parsed.port);
      setTls(parsed.tls);
      setConnectionMethod('manual');
    }
    if (params?.token) {
      setToken(params.token);
    }
  }, [route.params]);

  // ── Listen to connection state ─────────────────────────────────────────────

  useEffect(() => {
    setConnectionState(bridge.connectionState);
    const unsub = bridge.onConnectionStateChange(setConnectionState);
    return unsub;
  }, [bridge]);

  // ── Fetch bridge info when authenticated ───────────────────────────────────

  const fetchBridgeInfo = useCallback(async () => {
    if (!bridge.isConnected()) return;
    try {
      const [modelsRes, sessionsRes] = await Promise.all([
        bridge.listModels(),
        bridge.listSessions(),
      ]);
      setBridgeInfo({
        version: '1.0.0',
        sessions: sessionsRes.sessions.length,
        maxSessions: 5,
        models: modelsRes.models.map((m) => m.name),
      });
    } catch {
      // Info card won't show
    }
  }, [bridge]);

  useEffect(() => {
    if (isAuthenticated) fetchBridgeInfo();
    else setBridgeInfo(null);
  }, [isAuthenticated, fetchBridgeInfo]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleTestConnection = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTestResult(null);
    setIsConnecting(true);
    try {
      const url = buildWsUrl(host, port, tls);
      const result = await validateBridgeConnection(url, token || undefined);
      if (result.connected) {
        setTestResult({
          success: true,
          message: result.authenticated
            ? `Connected & authenticated (v${result.bridgeVersion})`
            : `Connected (v${result.bridgeVersion}) — not authenticated`,
        });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
      Haptics.notificationAsync(
        result.connected
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : String(err) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsConnecting(false);
    }
  }, [host, port, tls, token]);

  const handleConnect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsConnecting(true);
    try {
      const url = buildWsUrl(host, port, tls);
      const config: CopilotBridgeConfig = { url, token: token || undefined, reconnect: true };
      await saveBridgeConfig(config);
      bridge.connect(config);
    } catch (err) {
      Alert.alert('Connection Error', err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  }, [host, port, tls, token, bridge]);

  const handleDisconnect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Disconnect', 'Disconnect from the Copilot bridge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          bridge.disconnect();
          setBridgeInfo(null);
          setTestResult(null);
        },
      },
    ]);
  }, [bridge]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.systemGray6 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={sharedStyles.flex1}
        contentContainerStyle={{
          padding: Spacing.lg,
          gap: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Connection Status ──────────────────────────────────────────── */}
        <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
          <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
            Connection Status
          </Text>
          <XStack alignItems="center" gap={Spacing.sm} paddingBottom={Spacing.md}>
            <YStack
              width={10}
              height={10}
              borderRadius={5}
              backgroundColor={isConnected ? colors.healthyGreen : colors.destructive}
            />
            <YStack flex={1}>
              <Text fontSize={FontSize.body} fontWeight="500" color="$color">
                {isConnected ? 'Connected' : connectionState === 'connecting' ? 'Connecting…' : 'Disconnected'}
              </Text>
              {isConnected && (
                <XStack alignItems="center" gap={Spacing.sm} marginTop={2}>
                  <Text fontSize={FontSize.caption} color="$textTertiary">
                    {isAuthenticated ? 'Authenticated ✓' : 'Not authenticated'}
                  </Text>
                  {bridgeInfo && (
                    <>
                      <Text fontSize={FontSize.caption} color="$textTertiary">|</Text>
                      <Text fontSize={FontSize.caption} color="$textTertiary">
                        {bridgeInfo.models.length} models
                      </Text>
                    </>
                  )}
                </XStack>
              )}
            </YStack>
            {isConnected && (
              <TouchableOpacity
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radius.sm,
                  backgroundColor: colors.destructive,
                }}
                onPress={handleDisconnect}
                accessibilityLabel="Disconnect from bridge"
                accessibilityRole="button"
              >
                <Text fontSize={FontSize.caption} fontWeight="600" color="$contrastText">
                  Disconnect
                </Text>
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>

        {/* ── Connection Method ──────────────────────────────────────────── */}
        <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
          <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
            Connect
          </Text>
          <XStack backgroundColor={colors.systemGray5} borderRadius={Radius.sm} padding={2} marginBottom={Spacing.md}>
            {([
              { key: 'auto' as ConnectionMethod, label: 'Auto-discover', Icon: Wifi },
              { key: 'qr' as ConnectionMethod, label: 'QR Code', Icon: QrCode },
              { key: 'manual' as ConnectionMethod, label: 'Manual', Icon: Settings },
            ]).map(({ key, label, Icon }) => (
              <TouchableOpacity
                key={key}
                style={[
                  { flex: 1, flexDirection: 'row', paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 6, gap: 4 },
                  connectionMethod === key && {
                    backgroundColor: colors.cardBackground,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setConnectionMethod(key);
                }}
                accessibilityLabel={`Connection method: ${label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: connectionMethod === key }}
              >
                <Icon size={12} color={connectionMethod === key ? colors.text : colors.textTertiary} />
                <Text
                  fontSize={FontSize.caption}
                  fontWeight={connectionMethod === key ? '600' : '500'}
                  color={connectionMethod === key ? '$color' : '$textTertiary'}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {/* ── Auto-discover placeholder ──────────────────────────────────── */}
        {connectionMethod === 'auto' && (
          <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} paddingVertical={Spacing.lg} overflow="hidden" alignItems="center" gap={Spacing.sm}>
            <Wifi size={32} color={colors.textTertiary} />
            <Text fontSize={FontSize.body} fontWeight="500" color="$color" textAlign="center">
              mDNS Discovery
            </Text>
            <Text fontSize={FontSize.caption} color="$textTertiary" textAlign="center">
              Requires react-native-zeroconf. Scanning for bridges on the local network…
            </Text>
          </YStack>
        )}

        {/* ── QR Code placeholder ────────────────────────────────────────── */}
        {connectionMethod === 'qr' && (
          <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} paddingVertical={Spacing.lg} overflow="hidden" alignItems="center" gap={Spacing.sm}>
            <QrCode size={32} color={colors.textTertiary} />
            <Text fontSize={FontSize.body} fontWeight="500" color="$color" textAlign="center">
              Scan QR Code
            </Text>
            <Text fontSize={FontSize.caption} color="$textTertiary" textAlign="center">
              Point your camera at the QR code displayed on the bridge host.
            </Text>
          </YStack>
        )}

        {/* ── Manual Connection Form ─────────────────────────────────────── */}
        {connectionMethod === 'manual' && (
          <>
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                Manual Connection
              </Text>

              {/* Host */}
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Host</Text>
                <TextInput
                  style={inputStyle}
                  value={host}
                  onChangeText={setHost}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </XStack>
              <Separator borderColor="$separator" />

              {/* Port */}
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Port</Text>
                <TextInput
                  style={inputStyle}
                  value={port}
                  onChangeText={setPort}
                  placeholder="3030"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                />
              </XStack>
              <Separator borderColor="$separator" />

              {/* Token */}
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Token</Text>
                <TextInput
                  style={inputStyle}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Bearer token"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </XStack>
              <Separator borderColor="$separator" />

              {/* TLS */}
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>TLS</Text>
                <Switch
                  value={tls}
                  onValueChange={setTls}
                  trackColor={{ true: colors.primary, false: colors.systemGray4 }}
                  thumbColor={colors.contrastText}
                  accessibilityLabel="Enable TLS"
                />
              </XStack>
            </YStack>

            {/* ── Test Result ──────────────────────────────────────────────── */}
            {testResult && (
              <XStack
                backgroundColor={testResult.success ? colors.primaryMuted : 'rgba(239,68,68,0.1)'}
                borderRadius={Radius.sm}
                padding={Spacing.md}
                alignItems="center"
                gap={Spacing.sm}
              >
                {testResult.success ? (
                  <CheckCircle size={18} color={colors.primary} />
                ) : (
                  <XCircle size={18} color={colors.destructive} />
                )}
                <Text
                  fontSize={FontSize.footnote}
                  color={testResult.success ? '$color' : colors.destructive}
                  flex={1}
                >
                  {testResult.message}
                </Text>
              </XStack>
            )}

            {/* ── Buttons ─────────────────────────────────────────────────── */}
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: colors.primary,
                borderRadius: Radius.md,
                paddingVertical: Spacing.md + 2,
                alignItems: 'center',
              }}
              onPress={handleTestConnection}
              disabled={isConnecting || !host}
              accessibilityLabel="Test connection"
              accessibilityRole="button"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text color="$primary" fontSize={FontSize.body} fontWeight="600">
                  Test Connection
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: !host ? colors.systemGray4 : colors.primary,
                borderRadius: Radius.md,
                paddingVertical: Spacing.md + 2,
                alignItems: 'center',
              }}
              onPress={handleConnect}
              disabled={isConnecting || !host}
              accessibilityLabel="Connect and save"
              accessibilityRole="button"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.contrastText} />
              ) : (
                <Text color="$contrastText" fontSize={FontSize.body} fontWeight="600">
                  Connect &amp; Save
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── Bridge Info (only when connected) ──────────────────────────── */}
        {isConnected && bridgeInfo && (
          <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
            <XStack alignItems="center" gap={Spacing.sm} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
              <Server size={14} color={colors.textTertiary} />
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Bridge Info
              </Text>
            </XStack>

            {/* Version */}
            <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
              <Text color="$color" fontSize={FontSize.body} fontWeight="400">Version</Text>
              <Text color="$textTertiary" fontSize={FontSize.body}>{bridgeInfo.version}</Text>
            </XStack>
            <Separator borderColor="$separator" />

            {/* Sessions */}
            <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
              <Text color="$color" fontSize={FontSize.body} fontWeight="400">Sessions</Text>
              <Text color="$textTertiary" fontSize={FontSize.body}>
                {bridgeInfo.sessions} / {bridgeInfo.maxSessions}
              </Text>
            </XStack>
            <Separator borderColor="$separator" />

            {/* Models */}
            <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
              <Text color="$color" fontSize={FontSize.body} fontWeight="400">Models</Text>
              <Text color="$textTertiary" fontSize={FontSize.body} numberOfLines={1} flex={1} textAlign="right" marginLeft={Spacing.md}>
                {bridgeInfo.models.length > 0
                  ? bridgeInfo.models.length <= 2
                    ? bridgeInfo.models.join(', ')
                    : `${bridgeInfo.models[0]} +${bridgeInfo.models.length - 1}`
                  : 'None'}
              </Text>
            </XStack>
          </YStack>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
