/**
 * QuickSetupScreen — 3-step onboarding wizard with animated transitions.
 *
 * AI Provider flow:  Step 1: Choose provider → Step 2: API key → Step 3: Pick model
 * ACP/Codex flow:    Step 1: Choose ACP/Codex → Step 2: Host + token → Save
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  FlatList,
  View,
  UIManager,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Check, Search, Terminal, Server, ChevronDown, ChevronUp, Sliders, MessageSquare, Brain, Globe, Bot, Gem, Zap, Github, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ServerType } from '../acp/models/types';
import { AIProviderType } from '../ai/types';
import { getProviderInfo } from '../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../ai/ModelFetcher';
import { setCachedModels } from '../ai/ModelCache';
import { saveApiKey } from '../storage/SecureStorage';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type SetupFlow = 'ai' | 'acp';

interface PresetProvider {
  type: AIProviderType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultModelId: string;
}

interface ACPPreset {
  serverType: ServerType.ACP | ServerType.Codex | ServerType.CopilotCLI;
  label: string;
  description: string;
  defaultScheme: 'ws' | 'wss' | 'tcp';
  defaultHost: string;
  icon: LucideIcon;
}

const AI_PRESETS: PresetProvider[] = [
  {
    type: AIProviderType.OpenRouter,
    label: 'OpenRouter',
    description: 'Accesso a 200+ modelli con una sola API key',
    icon: Globe,
    defaultModelId: 'anthropic/claude-sonnet-4',
  },
  {
    type: AIProviderType.OpenAI,
    label: 'OpenAI',
    description: 'GPT-4o, o3 e famiglia ChatGPT',
    icon: Bot,
    defaultModelId: 'gpt-4o',
  },
  {
    type: AIProviderType.Anthropic,
    label: 'Anthropic',
    description: 'Claude Sonnet 4, Opus e famiglia',
    icon: Brain,
    defaultModelId: 'claude-sonnet-4-20250514',
  },
  {
    type: AIProviderType.Google,
    label: 'Google AI',
    description: 'Gemini 2.5 Pro e Flash',
    icon: Gem,
    defaultModelId: 'gemini-2.5-pro-preview-06-05',
  },
  {
    type: AIProviderType.Groq,
    label: 'Groq',
    description: 'Ultra veloce — Llama, Mixtral',
    icon: Zap,
    defaultModelId: 'llama-3.3-70b-versatile',
  },
];

const ACP_PRESETS: ACPPreset[] = [
  {
    serverType: ServerType.CopilotCLI,
    label: 'Copilot CLI',
    description: 'copilot --acp --port 3020',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3020',
    icon: Github,
  },
  {
    serverType: ServerType.ACP,
    label: 'Gemini CLI',
    description: 'gemini --acp (stdio→bridge)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3030',
    icon: Gem,
  },
  {
    serverType: ServerType.ACP,
    label: 'Claude Code',
    description: 'claude-code-acp (stdio→bridge)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3040',
    icon: Brain,
  },
  {
    serverType: ServerType.Codex,
    label: 'Codex CLI',
    description: 'codex --acp --port 8765',
    defaultScheme: 'ws',
    defaultHost: 'localhost:8765',
    icon: Bot,
  },
  {
    serverType: ServerType.ACP,
    label: 'CLI Generica',
    description: 'Qualsiasi agent ACP su rete',
    defaultScheme: 'ws',
    defaultHost: 'localhost:8765',
    icon: Server,
  },
];

export function QuickSetupScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuickSetup'>>();
  const editingServer = route.params?.editingServer;
  const { addServer, updateServer, servers } = useAppStore();
  const isEditing = !!editingServer;
  const editingAI = editingServer?.aiProviderConfig;

  // Determine initial state from editing server
  const initialPreset = editingAI
    ? AI_PRESETS.find(p => p.type === editingAI.providerType) ?? null
    : null;
  const initialACP = editingServer && editingServer.serverType !== ServerType.AIProvider
    ? ACP_PRESETS.find(p => p.serverType === editingServer.serverType) ?? null
    : null;
  const initialFlow: SetupFlow = initialACP ? 'acp' : 'ai';
  const initialStep = isEditing ? 1 : 0;

  // Wizard state
  const [step, setStep] = useState(initialStep);
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

  // Advanced AI settings
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
  const [cliExpanded, setCliExpanded] = useState(false);

  const stepCount = flow === 'acp' ? 2 : 3;

  // Stagger animation for step 0 cards (AI presets + 1 CLI group card)
  const cardAnims = useRef(
    [...AI_PRESETS, 'cli-group'].map(() => new Animated.Value(0)),
  ).current;

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

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  // AI Provider: Step 1 → 2
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

  // ACP/Codex: Step 1 → 2
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

  // Auto-fetch models when API key looks valid
  useEffect(() => {
    if (step !== 1 || !selectedPreset || !apiKey.trim()) return;
    // Wait for a reasonable key length before auto-fetching
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
    }, 800); // debounce

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

  // Final save — AI Provider
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

  // Final save — ACP/Codex
  const handleSaveACP = useCallback(async () => {
    if (!selectedACP || !acpHost.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Host richiesto', 'Inserisci l\'indirizzo del server (es. localhost:8765).');
      return;
    }

    // Sanitize host: strip protocol prefix and trailing slashes
    let cleanHost = acpHost.trim()
      .replace(/^wss?:\/\//i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');

    // Validate host:port format
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

  const handleAdvancedSetup = useCallback(() => {
    navigation.navigate('AddServer');
  }, [navigation]);

  // Filtered models for search
  const filteredModels = models.filter(m => {
    if (!modelSearch.trim()) return true;
    const q = modelSearch.toLowerCase();
    return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });

  // Static models fallback
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

  // ── Render Steps ──

  const renderStepIndicator = () => (
    <XStack justifyContent="center" gap={Spacing.xs} marginBottom={Spacing.lg}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === step ? colors.primary : colors.separator,
              width: i === step ? 24 : 8,
            },
          ]}
        />
      ))}
    </XStack>
  );

  const renderStep0 = () => {
    let cardIndex = 0;
    return (
    <YStack gap={Spacing.sm}>
      <YStack alignItems="center" gap={Spacing.sm} marginBottom={Spacing.lg}>
        <Text fontSize={34} fontWeight="700" color={colors.text}>
          {isEditing ? 'Modifica server' : 'Benvenuto 👋'}
        </Text>
        <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
          Scegli come connetterti
        </Text>
      </YStack>

      {/* AI Provider presets */}
      <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary} textTransform="uppercase" letterSpacing={0.5}>
        AI Provider
      </Text>
      {AI_PRESETS.map(preset => {
        const idx = cardIndex++;
        return (
        <Animated.View
          key={preset.type}
          style={{ opacity: cardAnims[idx], transform: [{ translateY: cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
        >
          <TouchableOpacity
            style={[styles.presetCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            onPress={() => handlePresetSelect(preset)}
            activeOpacity={0.7}
          >
            <XStack alignItems="center" gap={Spacing.md}>
              <preset.icon size={26} color={colors.primary} />
              <YStack flex={1}>
                <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
                  {preset.label}
                </Text>
                <Text fontSize={FontSize.footnote} color={colors.textTertiary} marginTop={2}>
                  {preset.description}
                </Text>
              </YStack>
              <ChevronRight size={18} color={colors.textTertiary} />
            </XStack>
          </TouchableOpacity>
        </Animated.View>
        );
      })}

      {/* Agent CLI — collapsible group */}
      <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary} textTransform="uppercase" letterSpacing={0.5} marginTop={Spacing.md}>
        Agent CLI (ACP)
      </Text>
      {(() => {
        const idx = cardIndex++;
        return (
        <Animated.View
          key="cli-group"
          style={{ opacity: cardAnims[idx], transform: [{ translateY: cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
        >
          <TouchableOpacity
            style={[styles.presetCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            onPress={() => setCliExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            <XStack alignItems="center" gap={Spacing.md}>
              <Terminal size={26} color={colors.text} />
              <YStack flex={1}>
                <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
                  Agent CLI
                </Text>
                <Text fontSize={FontSize.footnote} color={colors.textTertiary} marginTop={2}>
                  Copilot, Gemini, Claude Code, Codex…
                </Text>
              </YStack>
              {cliExpanded
                ? <ChevronUp size={18} color={colors.textTertiary} />
                : <ChevronDown size={18} color={colors.textTertiary} />}
            </XStack>
          </TouchableOpacity>

          {cliExpanded && (
            <YStack gap={Spacing.xs} marginTop={Spacing.xs} paddingLeft={Spacing.md}>
              {ACP_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.presetCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator, paddingVertical: 10 }]}
                  onPress={() => handleACPSelect(preset)}
                  activeOpacity={0.7}
                >
                  <XStack alignItems="center" gap={Spacing.sm}>
                    <preset.icon size={20} color={colors.primary} />
                    <YStack flex={1}>
                      <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>
                        {preset.label}
                      </Text>
                      <Text fontSize={FontSize.caption} color={colors.textTertiary}>
                        {preset.description}
                      </Text>
                    </YStack>
                    <ChevronRight size={16} color={colors.textTertiary} />
                  </XStack>
                </TouchableOpacity>
              ))}
            </YStack>
          )}
        </Animated.View>
        );
      })()}

      {/* Skip + Advanced */}
      <XStack justifyContent="space-between" marginTop={Spacing.md}>
        {servers.length > 0 && (
          <TouchableOpacity style={styles.advancedLink} onPress={() => navigation.goBack()}>
            <XStack alignItems="center" gap={4}>
              <ChevronLeft size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
                Torna alla chat
              </Text>
            </XStack>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.advancedLink} onPress={handleAdvancedSetup}>
          <XStack alignItems="center" gap={4}>
            <Text fontSize={FontSize.footnote} color={colors.primary}>
              Configurazione avanzata
            </Text>
            <ChevronRight size={14} color={colors.primary} />
          </XStack>
        </TouchableOpacity>
      </XStack>
    </YStack>
    );
  };

  const renderStep1AI = () => (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <XStack alignItems="center" gap={Spacing.sm}>
          {selectedPreset && <selectedPreset.icon size={22} color={colors.primary} />}
          <Text fontSize={24} fontWeight="700" color={colors.text}>
            {selectedPreset?.label}
          </Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          Inserisci la tua API key
        </Text>
      </YStack>

      <YStack gap={Spacing.sm}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
          placeholder={selectedPreset?.type === AIProviderType.OpenRouter ? 'sk-or-...' : 'sk-...'}
          placeholderTextColor={colors.textTertiary}
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {isFetching && (
          <XStack alignItems="center" gap={Spacing.xs}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              Caricamento modelli...
            </Text>
          </XStack>
        )}
        {fetchError && (
          <Text fontSize={FontSize.caption} color={colors.destructive}>
            {fetchError}
          </Text>
        )}
        {models.length > 0 && !isFetching && (
          <XStack alignItems="center" gap={4}>
            <Check size={14} color={colors.healthyGreen} />
            <Text fontSize={FontSize.caption} color={colors.healthyGreen}>
              {models.length} modelli trovati
            </Text>
          </XStack>
        )}

        <Text fontSize={FontSize.caption} color={colors.textTertiary}>
          La chiave viene salvata in modo sicuro sul dispositivo.{'\n'}
          I modelli vengono caricati automaticamente.
        </Text>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (apiKey.trim() || isEditing) ? 1 : 0.4 }]}
        onPress={goToModelStep}
        disabled={!apiKey.trim() && !isEditing}
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

  const renderStep1ACP = () => (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          {selectedACP?.label}
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
            placeholder={selectedACP?.label ?? 'My Agent'}
            placeholderTextColor={colors.textTertiary}
            value={acpName}
            onChangeText={setAcpName}
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
                    backgroundColor: acpScheme === s ? colors.primary : colors.cardBackground,
                    borderColor: acpScheme === s ? colors.primary : colors.separator,
                  },
                ]}
                onPress={() => { Haptics.selectionAsync(); setAcpScheme(s); }}
              >
                <Text
                  fontSize={FontSize.footnote}
                  fontWeight="600"
                  color={acpScheme === s ? colors.contrastText : colors.text}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {/* Host */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Host</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="localhost:8765"
            placeholderTextColor={colors.textTertiary}
            value={acpHost}
            onChangeText={setAcpHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
        </YStack>

        {/* Token (optional) */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Token (opzionale)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="Bearer token"
            placeholderTextColor={colors.textTertiary}
            value={acpToken}
            onChangeText={setAcpToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </YStack>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : (acpHost.trim() ? 1 : 0.4) }]}
        onPress={handleSaveACP}
        disabled={saving || !acpHost.trim()}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              {isEditing ? 'Salva modifiche' : 'Connetti'}
            </Text>
            <Check size={18} color={colors.contrastText} />
          </XStack>
        )}
      </TouchableOpacity>
    </YStack>
  );

  const renderStep1 = () => flow === 'acp' ? renderStep1ACP() : renderStep1AI();

  const renderStep2 = () => (
    <YStack gap={Spacing.md} flex={1}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          Scegli un modello
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          {displayModels.length} modelli disponibili
        </Text>
      </YStack>

      {/* Search */}
      <XStack
        alignItems="center"
        gap={Spacing.xs}
        paddingHorizontal={Spacing.md}
        paddingVertical={Spacing.sm}
        borderRadius={Radius.md}
        style={{ backgroundColor: colors.cardBackground }}
      >
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          style={{ flex: 1, fontSize: FontSize.body, color: colors.text, padding: 0 }}
          placeholder="Cerca modello..."
          placeholderTextColor={colors.textTertiary}
          value={modelSearch}
          onChangeText={setModelSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </XStack>

      {/* Model list */}
      <FlatList
        data={displayModels}
        keyExtractor={item => item.id}
        style={{ maxHeight: 260 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isSelected = item.id === selectedModelId;
          return (
            <TouchableOpacity
              style={[
                styles.modelRow,
                {
                  backgroundColor: isSelected ? colors.primaryMuted : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.separator,
                  borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedModelId(item.id);
              }}
              activeOpacity={0.7}
            >
              <YStack flex={1}>
                <Text fontSize={FontSize.body} fontWeight={isSelected ? '600' : '400'} color={colors.text} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text fontSize={FontSize.caption} color={colors.textTertiary} numberOfLines={1}>
                  {item.id}
                  {item.contextWindow ? ` · ${Math.round(item.contextWindow / 1000)}K ctx` : ''}
                </Text>
              </YStack>
              {isSelected && <Check size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      />

      {/* Advanced Settings (collapsible) */}
      <TouchableOpacity
        style={[styles.advancedToggle, { borderColor: colors.separator }]}
        onPress={() => { Haptics.selectionAsync(); setShowAdvanced(!showAdvanced); }}
        activeOpacity={0.7}
      >
        <XStack alignItems="center" gap={Spacing.xs} flex={1}>
          <Sliders size={16} color={colors.textTertiary} />
          <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textSecondary}>
            Impostazioni avanzate
          </Text>
        </XStack>
        {showAdvanced
          ? <ChevronUp size={16} color={colors.textTertiary} />
          : <ChevronDown size={16} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {showAdvanced && (
        <YStack gap={Spacing.md} paddingHorizontal={Spacing.xs}>
          {/* System Prompt */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <MessageSquare size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>System Prompt</Text>
            </XStack>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator },
              ]}
              placeholder="Sei un assistente utile..."
              placeholderTextColor={colors.textTertiary}
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </YStack>

          {/* Temperature */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <Sliders size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>
                Temperature: {temperature !== undefined ? temperature.toFixed(1) : 'Default'}
              </Text>
            </XStack>
            <XStack alignItems="center" gap={Spacing.sm}>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>0</Text>
              <View style={{ flex: 1 }}>
                <XStack alignItems="center">
                  {[0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.tempChip,
                        {
                          backgroundColor: temperature === val ? colors.primary : colors.cardBackground,
                          borderColor: temperature === val ? colors.primary : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTemperature(temperature === val ? undefined : val);
                      }}
                    >
                      <Text
                        fontSize={11}
                        fontWeight="600"
                        color={temperature === val ? colors.contrastText : colors.textTertiary}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </View>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>2</Text>
            </XStack>
          </YStack>

          {/* Reasoning (only if model supports it) */}
          {selectedModelInfo?.supportsReasoning && (
            <TouchableOpacity
              style={[
                styles.reasoningToggle,
                {
                  backgroundColor: reasoningEnabled ? colors.primaryMuted : colors.cardBackground,
                  borderColor: reasoningEnabled ? colors.primary : colors.separator,
                },
              ]}
              onPress={() => { Haptics.selectionAsync(); setReasoningEnabled(!reasoningEnabled); }}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" gap={Spacing.sm} flex={1}>
                <Brain size={18} color={reasoningEnabled ? colors.primary : colors.textTertiary} />
                <YStack>
                  <Text fontSize={FontSize.body} fontWeight="500" color={colors.text}>Extended Thinking</Text>
                  <Text fontSize={FontSize.caption} color={colors.textTertiary}>Ragionamento step-by-step</Text>
                </YStack>
              </XStack>
              <View style={[
                styles.toggleTrack,
                { backgroundColor: reasoningEnabled ? colors.primary : colors.systemGray4 },
              ]}>
                <View style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: reasoningEnabled ? 20 : 2 }] },
                ]} />
              </View>
            </TouchableOpacity>
          )}
        </YStack>
      )}

      {/* Save */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={handleSaveAI}
        disabled={saving || !selectedModelId}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              {isEditing ? 'Salva modifiche' : 'Inizia a chattare'}
            </Text>
            {isEditing ? <Check size={18} color={colors.contrastText} /> : <MessageSquare size={18} color={colors.contrastText} />}
          </XStack>
        )}
      </TouchableOpacity>
    </YStack>
  );

  const steps = [renderStep0, renderStep1, renderStep2];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + 80,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }], flex: 1 }}>
          {steps[step]()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
  },
  presetCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedLink: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  schemeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: undefined,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tempChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 1,
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
});
