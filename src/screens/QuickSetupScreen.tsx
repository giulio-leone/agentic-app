/**
 * QuickSetupScreen — Simplified onboarding for new users.
 * Shows preset provider cards (1-tap) or simple API key entry.
 * Goal: go from zero to chatting in under 30 seconds.
 */

import React, { useState, useCallback } from 'react';
import {
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ServerType } from '../acp/models/types';
import { AIProviderType } from '../ai/types';
import { saveApiKey } from '../storage/SecureStorage';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface PresetProvider {
  type: AIProviderType;
  label: string;
  description: string;
  icon: string;
  modelId: string;
  needsKey: boolean;
  baseUrl?: string;
}

const PRESETS: PresetProvider[] = [
  {
    type: AIProviderType.OpenRouter,
    label: 'OpenRouter',
    description: 'Accesso a 200+ modelli con una sola API key',
    icon: '🌐',
    modelId: 'anthropic/claude-sonnet-4',
    needsKey: true,
  },
  {
    type: AIProviderType.OpenAI,
    label: 'OpenAI',
    description: 'GPT-4o, o3 e famiglia ChatGPT',
    icon: '🤖',
    modelId: 'gpt-4o',
    needsKey: true,
  },
  {
    type: AIProviderType.Anthropic,
    label: 'Anthropic',
    description: 'Claude Sonnet 4, Opus e famiglia',
    icon: '🧠',
    modelId: 'claude-sonnet-4-20250514',
    needsKey: true,
  },
  {
    type: AIProviderType.Google,
    label: 'Google AI',
    description: 'Gemini 2.5 Pro e Flash',
    icon: '💎',
    modelId: 'gemini-2.5-pro-preview-06-05',
    needsKey: true,
  },
  {
    type: AIProviderType.Groq,
    label: 'Groq',
    description: 'Ultra veloce — Llama, Mixtral',
    icon: '⚡',
    modelId: 'llama-3.3-70b-versatile',
    needsKey: true,
  },
];

export function QuickSetupScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { addServer } = useAppStore();

  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePresetSelect = useCallback((preset: PresetProvider) => {
    Haptics.selectionAsync();
    setSelectedPreset(preset);
    setApiKey('');
  }, []);

  const handleQuickStart = useCallback(async () => {
    if (!selectedPreset) return;
    if (selectedPreset.needsKey && !apiKey.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('API Key richiesta', `Inserisci la tua API key per ${selectedPreset.label}.`);
      return;
    }

    setSaving(true);
    try {
      const serverData = {
        name: selectedPreset.label,
        scheme: '',
        host: '',
        token: '',
        cfAccessClientId: '',
        cfAccessClientSecret: '',
        workingDirectory: '',
        serverType: ServerType.AIProvider,
        aiProviderConfig: {
          providerType: selectedPreset.type,
          modelId: selectedPreset.modelId,
          baseUrl: selectedPreset.baseUrl,
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
  }, [selectedPreset, apiKey, addServer, navigation]);

  const handleAdvancedSetup = useCallback(() => {
    navigation.navigate('AddServer');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + 80,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <YStack alignItems="center" gap={Spacing.sm} marginTop={Spacing.xxl} marginBottom={Spacing.xl}>
          <Text fontSize={34} fontWeight="700" color={colors.text}>
            Benvenuto 👋
          </Text>
          <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
            Scegli un provider AI per iniziare a chattare
          </Text>
        </YStack>

        {/* Preset Cards */}
        <YStack gap={Spacing.sm}>
          {PRESETS.map(preset => {
            const isSelected = selectedPreset?.type === preset.type;
            return (
              <TouchableOpacity
                key={preset.type}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: isSelected ? colors.primaryMuted : colors.cardBackground,
                    borderColor: isSelected ? colors.primary : colors.separator,
                    borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
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
                  {isSelected && (
                    <Text fontSize={20} color={colors.primary}>✓</Text>
                  )}
                </XStack>
              </TouchableOpacity>
            );
          })}
        </YStack>

        {/* API Key Input — shown when a preset requiring key is selected */}
        {selectedPreset?.needsKey && (
          <YStack marginTop={Spacing.lg} gap={Spacing.sm}>
            <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textSecondary}>
              API Key per {selectedPreset.label}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.separator,
                },
              ]}
              placeholder="sk-..."
              placeholderTextColor={colors.textTertiary}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              La chiave viene salvata in modo sicuro sul dispositivo
            </Text>
          </YStack>
        )}

        {/* Start Button */}
        {selectedPreset && (
          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor: colors.primary,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={handleQuickStart}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.contrastText} />
            ) : (
              <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
                Inizia a chattare →
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Advanced setup link */}
        <TouchableOpacity
          style={styles.advancedLink}
          onPress={handleAdvancedSetup}
        >
          <Text fontSize={FontSize.footnote} color={colors.primary}>
            Configurazione avanzata →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  presetCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    fontFamily: 'monospace',
  },
  startButton: {
    marginTop: Spacing.xl,
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
});
