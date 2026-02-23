/**
 * Step1ACP — ACP/Codex server configuration step.
 */

import React from 'react';
import { TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step1ACPProps {
  w: WizardState;
  colors: ThemeColors;
}

export function Step1ACP({ w, colors }: Step1ACPProps) {
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

        {/* Host */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Host</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="192.168.1.10:8765"
            placeholderTextColor={colors.textTertiary}
            value={w.acpHost}
            onChangeText={w.setAcpHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
          <Text fontSize={11} color={colors.textTertiary}>
            IP locale, Tailscale, MeshNet o hostname — es. 100.64.x.x:8765
          </Text>
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
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
