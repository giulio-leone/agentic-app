/**
 * QuickSetupScreen — 3-step onboarding wizard with animated transitions.
 *
 * Step 1: Choose provider (preset cards)
 * Step 2: Enter API key + auto-fetch models
 * Step 3: Pick model → save → chat
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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Check, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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

interface PresetProvider {
  type: AIProviderType;
  label: string;
  description: string;
  icon: string;
  defaultModelId: string;
}

const PRESETS: PresetProvider[] = [
  {
    type: AIProviderType.OpenRouter,
    label: 'OpenRouter',
    description: 'Accesso a 200+ modelli con una sola API key',
    icon: '🌐',
    defaultModelId: 'anthropic/claude-sonnet-4',
  },
  {
    type: AIProviderType.OpenAI,
    label: 'OpenAI',
    description: 'GPT-4o, o3 e famiglia ChatGPT',
    icon: '🤖',
    defaultModelId: 'gpt-4o',
  },
  {
    type: AIProviderType.Anthropic,
    label: 'Anthropic',
    description: 'Claude Sonnet 4, Opus e famiglia',
    icon: '🧠',
    defaultModelId: 'claude-sonnet-4-20250514',
  },
  {
    type: AIProviderType.Google,
    label: 'Google AI',
    description: 'Gemini 2.5 Pro e Flash',
    icon: '💎',
    defaultModelId: 'gemini-2.5-pro-preview-06-05',
  },
  {
    type: AIProviderType.Groq,
    label: 'Groq',
    description: 'Ultra veloce — Llama, Mixtral',
    icon: '⚡',
    defaultModelId: 'llama-3.3-70b-versatile',
  },
];

const STEP_COUNT = 3;

export function QuickSetupScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { addServer } = useAppStore();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Step 1 → 2
  const handlePresetSelect = useCallback((preset: PresetProvider) => {
    Haptics.selectionAsync();
    setSelectedPreset(preset);
    setApiKey('');
    setModels([]);
    setSelectedModelId(preset.defaultModelId);
    setFetchError(null);
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
    if (!apiKey.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('API Key richiesta', `Inserisci la tua API key per ${selectedPreset?.label}.`);
      return;
    }
    Haptics.selectionAsync();
    animateStep(2);
  }, [apiKey, selectedPreset, animateStep]);

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    animateStep(step - 1);
  }, [step, animateStep]);

  // Final save
  const handleSave = useCallback(async () => {
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
          apiKey: apiKey.trim() || undefined,
        },
      };

      const serverId = await addServer(serverData);
      if (apiKey.trim()) {
        await saveApiKey(`${serverId}_${selectedPreset.type}`, apiKey.trim());
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

  // ── Render Steps ──

  const renderStepIndicator = () => (
    <XStack justifyContent="center" gap={Spacing.xs} marginBottom={Spacing.lg}>
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
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

  const renderStep0 = () => (
    <YStack gap={Spacing.sm}>
      <YStack alignItems="center" gap={Spacing.sm} marginBottom={Spacing.lg}>
        <Text fontSize={34} fontWeight="700" color={colors.text}>
          Benvenuto 👋
        </Text>
        <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
          Scegli un provider AI per iniziare
        </Text>
      </YStack>

      {PRESETS.map(preset => (
        <TouchableOpacity
          key={preset.type}
          style={[styles.presetCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
          onPress={() => handlePresetSelect(preset)}
          activeOpacity={0.7}
        >
          <XStack alignItems="center" gap={Spacing.md}>
            <Text fontSize={28}>{preset.icon}</Text>
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
      ))}

      <TouchableOpacity style={styles.advancedLink} onPress={handleAdvancedSetup}>
        <Text fontSize={FontSize.footnote} color={colors.primary}>
          Configurazione avanzata →
        </Text>
      </TouchableOpacity>
    </YStack>
  );

  const renderStep1 = () => (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          {selectedPreset?.icon} {selectedPreset?.label}
        </Text>
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
          <Text fontSize={FontSize.caption} color={colors.healthyGreen}>
            ✓ {models.length} modelli trovati
          </Text>
        )}

        <Text fontSize={FontSize.caption} color={colors.textTertiary}>
          La chiave viene salvata in modo sicuro sul dispositivo.{'\n'}
          I modelli vengono caricati automaticamente.
        </Text>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: apiKey.trim() ? 1 : 0.4 }]}
        onPress={goToModelStep}
        disabled={!apiKey.trim()}
        activeOpacity={0.8}
      >
        <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
          Scegli modello →
        </Text>
      </TouchableOpacity>
    </YStack>
  );

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
        style={{ maxHeight: 340 }}
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

      {/* Save */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        onPress={handleSave}
        disabled={saving || !selectedModelId}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
            Inizia a chattare ✨
          </Text>
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
    marginTop: Spacing.lg,
    alignItems: 'center',
    padding: Spacing.sm,
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
});
