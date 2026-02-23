/**
 * useAddServerForm — all state, derived values, and handlers for AddServerScreen.
 * Follows the w. prefix pattern for clean JSX consumption.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServerActions } from '../stores/selectors';
import { ServerType } from '../acp/models/types';
import { AIProviderType, AIProviderConfig, ReasoningEffort } from '../ai/types';
import { getProviderInfo } from '../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../ai/ModelFetcher';
import { getCachedModels, setCachedModels } from '../ai/ModelCache';
import { saveApiKey } from '../storage/SecureStorage';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddServer'>;

export function useAddServerForm() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddServer'>>();
  const editingServer = route.params?.editingServer;
  const { addServer, updateServer } = useServerActions();

  const editingAI = editingServer?.aiProviderConfig;
  const isEditing = !!editingServer;

  // ── Shared state ──
  const [name, setName] = useState(editingServer?.name ?? '');
  const [serverType, setServerType] = useState<ServerType>(
    editingServer?.serverType ?? ServerType.ACP,
  );

  // ── ACP / Codex fields ──
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

  // ── AI Provider fields ──
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>(
    editingAI?.providerType ?? AIProviderType.OpenAI,
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(editingAI?.modelId ?? '');
  const [systemPrompt, setSystemPrompt] = useState(editingAI?.systemPrompt ?? '');
  const [baseUrl, setBaseUrl] = useState(editingAI?.baseUrl ?? '');
  const [showBaseUrl, setShowBaseUrl] = useState(!!editingAI?.baseUrl || false);
  const [temperature, setTemperature] = useState<number | undefined>(editingAI?.temperature);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[] | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reasoningEnabled, setReasoningEnabled] = useState(editingAI?.reasoningEnabled ?? false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    editingAI?.reasoningEffort ?? 'medium',
  );

  // ── Derived values ──
  const providerInfo = useMemo(() => getProviderInfo(selectedProvider), [selectedProvider]);

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

  const selectedModelInfo = useMemo(
    () => displayModels.find(m => m.id === selectedModel),
    [displayModels, selectedModel],
  );

  const autoName = useMemo(() => {
    const model = selectedModelInfo;
    return model ? `${providerInfo.name} ${model.name}` : providerInfo.name;
  }, [providerInfo, selectedModelInfo]);

  // ── Effects ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedModels(selectedProvider);
      if (!cancelled && cached && cached.length > 0) setFetchedModels(cached);
    })();
    return () => { cancelled = true; };
  }, [selectedProvider]);

  // ── Handlers ──
  const handleProviderChange = useCallback((type: AIProviderType) => {
    Haptics.selectionAsync();
    setSelectedProvider(type);
    const info = getProviderInfo(type);
    setSelectedModel(info.models[0]?.id ?? '');
    setBaseUrl(info.defaultBaseUrl ?? '');
    setShowBaseUrl(info.requiresBaseUrl);
    setFetchedModels(null);
    setFetchError(null);
    setReasoningEnabled(false);
  }, []);

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

  const handleServerTypeChange = useCallback((type: ServerType) => {
    Haptics.selectionAsync();
    setServerType(type);
  }, []);

  const handleSave = useCallback(async () => {
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

    // ACP / Codex path
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
    name, scheme, host, token, cfAccessClientId, cfAccessClientSecret,
    workingDirectory, serverType, selectedProvider, selectedModel, apiKey,
    baseUrl, systemPrompt, temperature, reasoningEnabled, reasoningEffort,
    autoName, isEditing, editingServer, editingAI, addServer, updateServer, navigation,
  ]);

  return {
    // State
    name, setName,
    serverType, handleServerTypeChange,
    scheme, setScheme,
    host, setHost,
    token, setToken,
    workingDirectory, setWorkingDirectory,
    showAdvanced, setShowAdvanced,
    cfAccessClientId, setCfAccessClientId,
    cfAccessClientSecret, setCfAccessClientSecret,
    selectedProvider,
    apiKey, setApiKey,
    selectedModel, setSelectedModel,
    systemPrompt, setSystemPrompt,
    baseUrl, setBaseUrl,
    showBaseUrl, setShowBaseUrl,
    temperature, setTemperature,
    fetchedModels,
    isFetchingModels,
    fetchError,
    reasoningEnabled, setReasoningEnabled,
    reasoningEffort, setReasoningEffort,
    // Derived
    isEditing,
    providerInfo,
    displayModels,
    selectedModelInfo,
    autoName,
    // Handlers
    handleProviderChange,
    handleFetchModels,
    handleSave,
  };
}
