/**
 * Add/Edit Server screen — iOS Settings-style grouped fields.
 * Supports ACP, Codex, and AI Provider server types.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { YStack, XStack, Text, Separator } from 'tamagui';
import { Lock, Brain, Eye } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ServerType } from '../acp/models/types';
import { AIProviderType, AIProviderConfig, ReasoningEffort } from '../ai/types';
import { ALL_PROVIDERS, getProviderInfo } from '../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../ai/ModelFetcher';
import { getCachedModels, setCachedModels } from '../ai/ModelCache';
import { saveApiKey } from '../storage/SecureStorage';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddServer'>;

export function AddServerScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddServer'>>();
  const editingServer = route.params?.editingServer;
  const { addServer, updateServer } = useAppStore();

  // Shared state
  const [name, setName] = useState(editingServer?.name ?? '');
  const [serverType, setServerType] = useState<ServerType>(
    editingServer?.serverType ?? ServerType.ACP,
  );

  // ACP / Codex fields
  const [scheme, setScheme] = useState(editingServer?.scheme ?? 'ws');
  const [host, setHost] = useState(editingServer?.host ?? '');
  const [token, setToken] = useState(editingServer?.token ?? '');
  const [workingDirectory, setWorkingDirectory] = useState(
    editingServer?.workingDirectory ?? '',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfAccessClientId, setCfAccessClientId] = useState(
    editingServer?.cfAccessClientId ?? '',
  );
  const [cfAccessClientSecret, setCfAccessClientSecret] = useState(
    editingServer?.cfAccessClientSecret ?? '',
  );

  // AI Provider fields
  const editingAI = editingServer?.aiProviderConfig;
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>(
    editingAI?.providerType ?? AIProviderType.OpenAI,
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    editingAI?.modelId ?? '',
  );
  const [systemPrompt, setSystemPrompt] = useState(
    editingAI?.systemPrompt ?? '',
  );
  const [baseUrl, setBaseUrl] = useState(editingAI?.baseUrl ?? '');
  const [showBaseUrl, setShowBaseUrl] = useState(
    !!editingAI?.baseUrl || false,
  );
  const [temperature, setTemperature] = useState<number | undefined>(
    editingAI?.temperature,
  );
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[] | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reasoningEnabled, setReasoningEnabled] = useState(
    editingAI?.reasoningEnabled ?? false,
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    editingAI?.reasoningEffort ?? 'medium',
  );

  const isEditing = !!editingServer;

  const providerInfo = useMemo(
    () => getProviderInfo(selectedProvider),
    [selectedProvider],
  );

  // Auto-select first model when provider changes
  const handleProviderChange = useCallback(
    (type: AIProviderType) => {
      Haptics.selectionAsync();
      setSelectedProvider(type);
      const info = getProviderInfo(type);
      setSelectedModel(info.models[0]?.id ?? '');
      setBaseUrl(info.defaultBaseUrl ?? '');
      setShowBaseUrl(info.requiresBaseUrl);
      setFetchedModels(null);
      setFetchError(null);
      setReasoningEnabled(false);
    },
    [],
  );

  // Load cached models on mount / provider change
  useEffect(() => {
    (async () => {
      const cached = await getCachedModels(selectedProvider);
      if (cached && cached.length > 0) {
        setFetchedModels(cached);
      }
    })();
  }, [selectedProvider]);

  const handleFetchModels = useCallback(async () => {
    if (!apiKey.trim()) {
      Alert.alert('API Key Required', 'Enter your API key first to fetch available models.');
      return;
    }
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const info = getProviderInfo(selectedProvider);
      const models = await fetchModelsFromProvider(
        selectedProvider,
        apiKey.trim(),
        baseUrl.trim() || info.defaultBaseUrl,
      );
      setFetchedModels(models);
      await setCachedModels(selectedProvider, models);
      if (models.length > 0) setSelectedModel(models[0].id);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setIsFetchingModels(false);
    }
  }, [apiKey, selectedProvider, baseUrl]);

  // Models to display: fetched > static
  const displayModels = useMemo(() => {
    if (fetchedModels && fetchedModels.length > 0) return fetchedModels;
    return providerInfo.models.map(m => ({
      id: m.id,
      name: m.name,
      contextWindow: m.contextWindow,
      supportsReasoning: m.supportsReasoning,
      supportsTools: m.supportsTools,
      supportsVision: m.supportsVision,
      supportedParameters: m.supportedParameters,
    }));
  }, [fetchedModels, providerInfo]);

  // Check if selected model supports reasoning
  const selectedModelInfo = useMemo(
    () => displayModels.find(m => m.id === selectedModel),
    [displayModels, selectedModel],
  );

  // Auto-fill name from provider + model
  const autoName = useMemo(() => {
    const model = selectedModelInfo;
    return model ? `${providerInfo.name} ${model.name}` : providerInfo.name;
  }, [providerInfo, selectedModelInfo]);

  // ── Save logic ──

  const handleSave = useCallback(async () => {
    // AI Provider path
    if (serverType === ServerType.AIProvider) {
      if (!apiKey.trim() && !isEditing) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Missing Field', 'Please enter your API key.');
        return;
      }
      if (!selectedModel) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Missing Field', 'Please select a model.');
        return;
      }

      const serverData = {
        name: name.trim() || autoName,
        scheme: '',
        host: '',
        token: '',
        cfAccessClientId: '',
        cfAccessClientSecret: '',
        workingDirectory: '',
        serverType: ServerType.AIProvider,
        aiProviderConfig: {
          providerType: selectedProvider,
          modelId: selectedModel,
          baseUrl: baseUrl.trim() || undefined,
          systemPrompt: systemPrompt.trim() || undefined,
          temperature,
          reasoningEnabled: reasoningEnabled || undefined,
          reasoningEffort: reasoningEnabled ? reasoningEffort : undefined,
          // Persist key in config as fallback when SecureStore is unavailable
          apiKey: apiKey.trim() || editingAI?.apiKey || undefined,
        } as AIProviderConfig,
      };

      try {
        if (isEditing && editingServer) {
          await updateServer({ ...serverData, id: editingServer.id });
          if (apiKey.trim()) {
            await saveApiKey(`${editingServer.id}_${selectedProvider}`, apiKey.trim());
          }
        } else {
          const serverId = await addServer(serverData);
          if (apiKey.trim()) {
            await saveApiKey(`${serverId}_${selectedProvider}`, apiKey.trim());
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', `Failed to save server: ${(error as Error).message}`);
      }
      return;
    }

    // ACP / Codex path — sanitize host
    const hostValue = host.trim()
      .replace(/^wss?:\/\//i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
    if (!hostValue) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing Field', 'Please enter a host address (e.g. localhost:8765)');
      return;
    }

    const serverData = {
      name: name.trim() || hostValue,
      scheme,
      host: hostValue,
      token: token.trim(),
      cfAccessClientId: cfAccessClientId.trim(),
      cfAccessClientSecret: cfAccessClientSecret.trim(),
      workingDirectory: workingDirectory.trim(),
      serverType,
    };

    try {
      if (isEditing && editingServer) {
        await updateServer({ ...serverData, id: editingServer.id });
      } else {
        await addServer(serverData);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to save server: ${(error as Error).message}`);
    }
  }, [
    name,
    scheme,
    host,
    token,
    cfAccessClientId,
    cfAccessClientSecret,
    workingDirectory,
    serverType,
    selectedProvider,
    selectedModel,
    apiKey,
    baseUrl,
    systemPrompt,
    temperature,
    reasoningEnabled,
    reasoningEffort,
    autoName,
    isEditing,
    editingServer,
    addServer,
    updateServer,
    navigation,
  ]);

  // ── Render ──

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.systemGray6 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Protocol section — 3-segment */}
        <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
          <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
            Protocol
          </Text>
          <XStack backgroundColor={colors.systemGray5} borderRadius={Radius.sm} padding={2} marginBottom={Spacing.md}>
            {([ServerType.ACP, ServerType.Codex, ServerType.AIProvider] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: 6 },
                  serverType === type && {
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
                  setServerType(type);
                }}
              >
                <Text
                  fontSize={FontSize.footnote}
                  fontWeight={serverType === type ? '600' : '500'}
                  color={serverType === type ? '$color' : '$textTertiary'}
                >
                  {type === ServerType.AIProvider ? 'AI Provider' : type === ServerType.Codex ? 'Codex' : 'ACP'}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {serverType === ServerType.AIProvider ? (
          <>
            {/* Provider Picker — horizontal scroll chips */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                Provider
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
              >
                {ALL_PROVIDERS.map(p => {
                  const isSelected = p.type === selectedProvider;
                  return (
                    <TouchableOpacity
                      key={p.type}
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: Radius.full,
                          borderWidth: 1,
                          borderColor: colors.separator,
                          gap: 4,
                        },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleProviderChange(p.type)}
                      activeOpacity={0.7}
                    >
                      <Text fontSize={14}>{p.icon}</Text>
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight="500"
                        color={isSelected ? '$contrastText' : '$color'}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </YStack>

            {/* API Key */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>API Key</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={isEditing ? '••••••••' : 'sk-...'}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </XStack>
              <XStack alignItems="center" gap={4}>
                <Lock size={12} color={colors.textTertiary} />
                <Text color="$textTertiary" fontSize={FontSize.caption} paddingBottom={Spacing.md}>
                  Stored securely on device
                </Text>
              </XStack>
            </YStack>

            {/* Model Picker */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between">
                <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                  Model
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 6,
                    borderRadius: Radius.sm,
                    marginTop: Spacing.sm,
                    minWidth: 60,
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                  }}
                  onPress={handleFetchModels}
                  disabled={isFetchingModels}
                  activeOpacity={0.7}
                  accessibilityLabel={fetchedModels ? 'Refresh models list' : 'Fetch available models'}
                >
                  {isFetchingModels ? (
                    <ActivityIndicator size="small" color={colors.contrastText} />
                  ) : (
                    <Text color="$contrastText" fontSize={FontSize.caption} fontWeight="600">
                      {fetchedModels ? '↻ Refresh' : '⬇ Fetch Models'}
                    </Text>
                  )}
                </TouchableOpacity>
              </XStack>
              {fetchError && (
                <Text color={colors.destructive} fontSize={FontSize.caption} paddingBottom={Spacing.sm}>
                  {fetchError}
                </Text>
              )}
              {displayModels.map((model, idx) => {
                const isSelected = model.id === selectedModel;
                return (
                  <React.Fragment key={model.id}>
                    {idx > 0 && (
                      <Separator borderColor="$separator" />
                    )}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: Spacing.md,
                        minHeight: 44,
                      }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedModel(model.id);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel={`Select model: ${model.name}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <YStack flex={1}>
                        <Text color="$color" fontSize={FontSize.body}>{model.name}</Text>
                        <XStack alignItems="center" gap={6} marginTop={2}>
                          {model.contextWindow != null && (
                            <Text color="$textTertiary" fontSize={FontSize.caption}>
                              {Math.round(model.contextWindow / 1000)}K
                            </Text>
                          )}
                          {model.supportsReasoning && (
                            <Brain size={12} color={colors.primary} />
                          )}
                          {model.supportsVision && (
                            <Eye size={12} color={colors.primary} />
                          )}
                        </XStack>
                      </YStack>
                      <YStack
                        width={22}
                        height={22}
                        borderRadius={11}
                        borderWidth={2}
                        borderColor={isSelected ? '$primary' : colors.systemGray3}
                        backgroundColor={isSelected ? '$primary' : undefined}
                        alignItems="center"
                        justifyContent="center"
                        marginLeft={Spacing.md}
                      >
                        {isSelected && (
                          <YStack width={10} height={10} borderRadius={5} backgroundColor="$contrastText" />
                        )}
                      </YStack>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </YStack>

            {/* Reasoning Controls — shown when selected model supports reasoning */}
            {selectedModelInfo?.supportsReasoning && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                  Reasoning
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: Spacing.md,
                    minHeight: 44,
                  }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReasoningEnabled(!reasoningEnabled);
                  }}
                  activeOpacity={0.7}
                >
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400">
                    Enable Reasoning
                  </Text>
                  <YStack
                    width={48}
                    height={28}
                    borderRadius={14}
                    padding={2}
                    justifyContent="center"
                    backgroundColor={reasoningEnabled ? '$primary' : colors.systemGray4}
                  >
                    <YStack
                      width={24}
                      height={24}
                      borderRadius={12}
                      backgroundColor="$contrastText"
                      alignSelf={reasoningEnabled ? 'flex-end' : undefined}
                    />
                  </YStack>
                </TouchableOpacity>
                {reasoningEnabled && (
                  <>
                    <Separator borderColor="$separator" />
                    <Text color="$textTertiary" fontSize={FontSize.caption} paddingBottom={Spacing.sm} paddingTop={Spacing.xs}>
                      Effort: {reasoningEffort}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
                    >
                      {(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as ReasoningEffort[]).map(level => {
                        const isSelected = reasoningEffort === level;
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[
                              {
                                paddingHorizontal: Spacing.md,
                                paddingVertical: 8,
                                borderRadius: Radius.md,
                                borderWidth: 1,
                                borderColor: colors.separator,
                                marginRight: Spacing.sm,
                              },
                              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setReasoningEffort(level);
                            }}
                          >
                            <Text
                              fontSize={FontSize.footnote}
                              fontWeight="600"
                              color={isSelected ? '$contrastText' : '$color'}
                            >
                              {level}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </YStack>
            )}

            {/* Name */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Name</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                  value={name}
                  onChangeText={setName}
                  placeholder={autoName}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </XStack>
            </YStack>

            {/* System Prompt */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                System Prompt (optional)
              </Text>
              <TextInput
                style={{ fontSize: FontSize.body, color: colors.text, paddingVertical: Spacing.sm, paddingBottom: Spacing.md, minHeight: 80 }}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="You are a helpful assistant..."
                placeholderTextColor={colors.systemGray2}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </YStack>

            {/* Temperature */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                Temperature: {temperature !== undefined ? temperature.toFixed(1) : 'Default'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
              >
                {[undefined, 0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0].map((t, idx) => {
                  const isSelected = temperature === t;
                  const label = t === undefined ? 'Auto' : t.toFixed(1);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        {
                          paddingHorizontal: Spacing.md,
                          paddingVertical: 8,
                          borderRadius: Radius.md,
                          borderWidth: 1,
                          borderColor: colors.separator,
                          marginRight: Spacing.sm,
                        },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTemperature(t);
                      }}
                    >
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight="600"
                        color={isSelected ? '$contrastText' : '$color'}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </YStack>

            {/* Base URL — shown for Custom or on demand */}
            {(providerInfo.requiresBaseUrl || showBaseUrl) && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Base URL</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                    value={baseUrl}
                    onChangeText={setBaseUrl}
                    placeholder={providerInfo.defaultBaseUrl ?? 'https://api.example.com/v1'}
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </XStack>
              </YStack>
            )}

            {/* Toggle Base URL override for non-Custom providers */}
            {!providerInfo.requiresBaseUrl && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.cardBackground,
                  borderRadius: Radius.md,
                  paddingHorizontal: Spacing.lg,
                  overflow: 'hidden',
                }}
                onPress={() => setShowBaseUrl(!showBaseUrl)}
                activeOpacity={0.7}
              >
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Override Base URL</Text>
                  <Text color="$textTertiary" fontSize={14}>
                    {showBaseUrl ? '▾' : '▸'}
                  </Text>
                </XStack>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Connection section — ACP / Codex */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Name</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                  value={name}
                  onChangeText={setName}
                  placeholder="My Agent"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </XStack>
              <Separator borderColor="$separator" />
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Scheme</Text>
                <XStack backgroundColor={colors.systemGray5} borderRadius={6} padding={2}>
                  {(['ws', 'wss'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 5 },
                        scheme === s && {
                          backgroundColor: colors.cardBackground,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2,
                        },
                      ]}
                      onPress={() => setScheme(s)}
                    >
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight={scheme === s ? '600' : '500'}
                        color={scheme === s ? '$color' : '$textTertiary'}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </XStack>
              <Separator borderColor="$separator" />
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Host</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                  value={host}
                  onChangeText={setHost}
                  placeholder="localhost:8765"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </XStack>
            </YStack>

            {/* Optional section */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Token</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
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
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Directory</Text>
                <TextInput
                  style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                  value={workingDirectory}
                  onChangeText={setWorkingDirectory}
                  placeholder="/path/to/workspace"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </XStack>
            </YStack>

            {/* Advanced: Cloudflare Access */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.cardBackground,
                borderRadius: Radius.md,
                paddingHorizontal: Spacing.lg,
                overflow: 'hidden',
              }}
              onPress={() => setShowAdvanced(!showAdvanced)}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Cloudflare Access</Text>
                <Text color="$textTertiary" fontSize={14}>
                  {showAdvanced ? '▾' : '▸'}
                </Text>
              </XStack>
            </TouchableOpacity>

            {showAdvanced && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Client ID</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                    value={cfAccessClientId}
                    onChangeText={setCfAccessClientId}
                    placeholder="Client ID"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </XStack>
                <Separator borderColor="$separator" />
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Secret</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right', paddingVertical: 0 }}
                    value={cfAccessClientSecret}
                    onChangeText={setCfAccessClientSecret}
                    placeholder="Client Secret"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </XStack>
              </YStack>
            )}
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: Radius.md,
            paddingVertical: Spacing.md + 2,
            alignItems: 'center',
            marginTop: Spacing.sm,
          }}
          onPress={handleSave}
          accessibilityLabel={isEditing ? 'Update server' : 'Save new server'}
        >
          <Text color="$contrastText" fontSize={FontSize.body} fontWeight="600">
            {isEditing ? 'Update Server' : 'Add Server'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
