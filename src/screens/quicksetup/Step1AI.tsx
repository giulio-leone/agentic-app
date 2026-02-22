/**
 * Step1AI — API key input step for AI provider flow.
 */

import React from 'react';
import { TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import { AIProviderType } from '../../ai/types';
import type { useQuickSetupWizard } from './useQuickSetupWizard';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step1AIProps {
  w: WizardState;
  colors: ThemeColors;
}

export function Step1AI({ w, colors }: Step1AIProps) {
  return (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <XStack alignItems="center" gap={Spacing.sm}>
          {w.selectedPreset && <w.selectedPreset.icon size={22} color={colors.primary} />}
          <Text fontSize={24} fontWeight="700" color={colors.text}>
            {w.selectedPreset?.label}
          </Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          Inserisci la tua API key
        </Text>
      </YStack>

      <YStack gap={Spacing.sm}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
          placeholder={w.selectedPreset?.type === AIProviderType.OpenRouter ? 'sk-or-...' : 'sk-...'}
          placeholderTextColor={colors.textTertiary}
          value={w.apiKey}
          onChangeText={w.setApiKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {w.isFetching && (
          <XStack alignItems="center" gap={Spacing.xs}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              Caricamento modelli...
            </Text>
          </XStack>
        )}
        {w.fetchError && (
          <Text fontSize={FontSize.caption} color={colors.destructive}>
            {w.fetchError}
          </Text>
        )}
        {w.models.length > 0 && !w.isFetching && (
          <XStack alignItems="center" gap={4}>
            <Check size={14} color={colors.healthyGreen} />
            <Text fontSize={FontSize.caption} color={colors.healthyGreen}>
              {w.models.length} modelli trovati
            </Text>
          </XStack>
        )}

        <Text fontSize={FontSize.caption} color={colors.textTertiary}>
          La chiave viene salvata in modo sicuro sul dispositivo.{'\n'}
          I modelli vengono caricati automaticamente.
        </Text>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (w.apiKey.trim() || w.isEditing) ? 1 : 0.4 }]}
        onPress={w.goToModelStep}
        disabled={!w.apiKey.trim() && !w.isEditing}
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
});
