/**
 * useQuickSetupWizard — All state and handlers for the QuickSetup wizard.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServers, useServerActions } from '../../stores/selectors';
import { ServerType } from '../../acp/models/types';
import { AIProviderType } from '../../ai/types';
import { getProviderInfo } from '../../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../../ai/ModelFetcher';
import { setCachedModels } from '../../ai/ModelCache';
import { saveApiKey } from '../../storage/SecureStorage';
import type { RootStackParamList } from '../../navigation';
import { AI_PRESETS, ACP_PRESETS, type PresetProvider, type ACPPreset } from './presets';

type SetupFlow = 'ai' | 'acp';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function useQuickSetupWizard() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuickSetup'>>();
  const editingServer = route.params?.editingServer;
  const { addServer, updateServer } = useServerActions();
  const servers = useServers();
  const isEditing = !!editingServer;
  const editingAI = editingServer?.aiProviderConfig;

  // ── Initial state from editing ──
  const initialPreset = editingAI
    ? AI_PRESETS.find(p => p.type === editingAI.providerType) ?? null
    : null;
  const initialACP = editingServer && editingServer.serverType !== ServerType.AIProvider
    ? ACP_PRESETS.find(p => p.serverType === editingServer.serverType) ?? null
    : null;
  const initialFlow: SetupFlow = initialACP ? 'acp' : 'ai';

  // ── Wizard state ──
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [flow, setFlow] = useState<SetupFlow>(initialFlow);
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(initialPreset);
  const [selectedACP, setSelectedACP] = useState<ACPPreset | null>(initialACP);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(editingAI?.modelId ?? '');
  const [modelSearch, setModelSearch] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Advanced AI
  const [systemPrompt, setSystemPrompt] = useState(editingAI?.systemPrompt ?? '');
  const [temperature, setTemperature] = useState<number | undefined>(editingAI?.temperature);
  const [reasoningEnabled, setReasoningEnabled] = useState(editingAI?.reasoningEnabled ?? false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(editingAI?.systemPrompt || editingAI?.temperature !== undefined || editingAI?.reasoningEnabled),
  );

  // ACP state
  const [acpScheme, setAcpScheme] = useState<'ws' | 'wss' | 'tcp'>(
    (editingServer?.scheme as 'ws' | 'wss' | 'tcp') ?? 'ws',
  );
  const [acpHost, setAcpHost] = useState(editingServer?.host ?? '');
  const [acpToken, setAcpToken] = useState(editingServer?.token ?? '');
  const [acpName, setAcpName] = useState(editingServer?.name ?? '');

  const stepCount = flow === 'acp' ? 2 : 3;

  // ── Animations ──
  const cardAnims = useRef(
    [...AI_PRESETS, ...ACP_PRESETS].map(() => new Animated.Value(0)),
  ).current;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step !== 0) return;
    cardAnims.forEach(a => a.setValue(0));
    const animations = cardAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: i * 60,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(60, animations).start();
  }, [step, cardAnims]);

  const animateStep = useCallback((toStep: number) => {
    const direction = toStep > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(toStep);
      slideAnim.setValue(direction * 30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start();
    });
  }, [step, fadeAnim, slideAnim]);

  // ── Handlers ──
  const handlePresetSelect = useCallback((preset: PresetProvider) => {
    Haptics.selectionAsync();
    setFlow('ai');
    setSelectedPreset(preset);
    setApiKey('');
    setModels([]);
    setSelectedModelId(preset.defaultModelId);
    setFetchError(null);
    animateStep(1);
  }, [animateStep]);

  const handleACPSelect = useCallback((preset: ACPPreset) => {
    Haptics.selectionAsync();
    setFlow('acp');
    setSelectedACP(preset);
    setAcpScheme(preset.defaultScheme);
    setAcpHost(preset.defaultHost);
    setAcpName(preset.label);
    setAcpToken('');
    animateStep(1);
  }, [animateStep]);

  // Auto-fetch models
  useEffect(() => {
    if (step !== 1 || !selectedPreset || !apiKey.trim()) return;
    const minLen = selectedPreset.type === AIProviderType.Google ? 20 : 10;
    if (apiKey.trim().length < minLen) return;

    const timer = setTimeout(async () => {
      setIsFetching(true);
      setFetchError(null);
      try {
        const info = getProviderInfo(selectedPreset.type);
        const fetched = await fetchModelsFromProvider(
          selectedPreset.type,
          apiKey.trim(),
          info.defaultBaseUrl,
        );
        setModels(fetched);
        await setCachedModels(selectedPreset.type, fetched);
        if (fetched.length > 0 && !fetched.find(m => m.id === selectedModelId)) {
          setSelectedModelId(fetched[0].id);
        }
      } catch (err) {
        setFetchError((err as Error).message);
      } finally {
        setIsFetching(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [apiKey, step, selectedPreset, selectedModelId]);

  const goToModelStep = useCallback(() => {
    if (!apiKey.trim() && !isEditing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('API Key richiesta', `Inserisci la tua API key per ${selectedPreset?.label}.`);
      return;
    }
    Haptics.selectionAsync();
    animateStep(2);
  }, [apiKey, selectedPreset, isEditing, animateStep]);

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    animateStep(step - 1);
  }, [step, animateStep]);

  // ── Save AI ──
  const handleSaveAI = useCallback(async () => {
    if (!selectedPreset || !selectedModelId) return;
    setSaving(true);
    try {
      const info = getProviderInfo(selectedPreset.type);
      const modelInfo = models.find(m => m.id === selectedModelId);
      const serverName = modelInfo
        ? `${selectedPreset.label} — ${modelInfo.name}`
        : selectedPreset.label;

      const serverData = {
        name: serverName,
        scheme: '',
        host: '',
        token: '',
        cfAccessClientId: '',
        cfAccessClientSecret: '',
        workingDirectory: '',
        serverType: ServerType.AIProvider,
        aiProviderConfig: {
          providerType: selectedPreset.type,
          modelId: selectedModelId,
          baseUrl: info.defaultBaseUrl || undefined,
          apiKey: apiKey.trim() || editingAI?.apiKey || undefined,
          systemPrompt: systemPrompt.trim() || undefined,
          temperature,
          reasoningEnabled: reasoningEnabled || undefined,
        },
      };

      if (isEditing && editingServer) {
        await updateServer({ ...serverData, id: editingServer.id });
        if (apiKey.trim()) {
          await saveApiKey(`${editingServer.id}_${selectedPreset.type}`, apiKey.trim());
        }
      } else {
        const serverId = await addServer(serverData);
        if (apiKey.trim()) {
          await saveApiKey(`${serverId}_${selectedPreset.type}`, apiKey.trim());
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Errore', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedPreset, selectedModelId, models, apiKey, addServer, navigation]);

  // ── Save ACP ──
  const handleSaveACP = useCallback(async () => {
    if (!selectedACP || !acpHost.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Host richiesto', 'Inserisci l\'indirizzo del server (es. localhost:8765).');
      return;
    }

    let cleanHost = acpHost.trim()
      .replace(/^wss?:\/\//i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');

    const hostPortRegex = /^[\w.\-]+:\d{1,5}$/;
    if (!hostPortRegex.test(cleanHost)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Formato host non valido', 'Usa il formato host:porta (es. localhost:4500).');
      return;
    }

    setSaving(true);
    try {
      const serverData = {
        name: acpName.trim() || selectedACP.label,
        scheme: acpScheme,
        host: cleanHost,
        token: acpToken.trim(),
        cfAccessClientId: '',
        cfAccessClientSecret: '',
        workingDirectory: '',
        serverType: selectedACP.serverType,
      };

      if (isEditing && editingServer) {
        await updateServer({ ...serverData, id: editingServer.id });
      } else {
        await addServer(serverData);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Errore', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedACP, acpScheme, acpHost, acpToken, acpName, isEditing, editingServer, addServer, updateServer, navigation]);

  // Filtered / display models
  const filteredModels = models.filter(m => {
    if (!modelSearch.trim()) return true;
    const q = modelSearch.toLowerCase();
    return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });

  const displayModels = models.length > 0 ? filteredModels : (() => {
    if (!selectedPreset) return [];
    const info = getProviderInfo(selectedPreset.type);
    return info.models
      .filter(m => {
        if (!modelSearch.trim()) return true;
        const q = modelSearch.toLowerCase();
        return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
      })
      .map(m => ({
        id: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
        supportsReasoning: m.supportsReasoning,
        supportsTools: m.supportsTools,
        supportsVision: m.supportsVision,
        supportedParameters: m.supportedParameters,
      } as FetchedModel));
  })();

  const selectedModelInfo = displayModels.find(m => m.id === selectedModelId);

  return {
    // Navigation
    navigation,
    isEditing,
    editingServer,
    editingAI,
    servers,
    // Step
    step,
    stepCount,
    flow,
    // Animations
    cardAnims,
    slideAnim,
    fadeAnim,
    // AI state
    selectedPreset,
    apiKey,
    setApiKey,
    isFetching,
    fetchError,
    models,
    displayModels,
    selectedModelId,
    setSelectedModelId,
    selectedModelInfo,
    modelSearch,
    setModelSearch,
    // Advanced
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    reasoningEnabled,
    setReasoningEnabled,
    showAdvanced,
    setShowAdvanced,
    // ACP state
    selectedACP,
    acpScheme,
    setAcpScheme,
    acpHost,
    setAcpHost,
    acpToken,
    setAcpToken,
    acpName,
    setAcpName,
    // Flags
    saving,
    // Handlers
    handlePresetSelect,
    handleACPSelect,
    goToModelStep,
    goBack,
    handleSaveAI,
    handleSaveACP,
  };
}
