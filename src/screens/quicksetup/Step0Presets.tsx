/**
 * Step0Presets — provider/ACP selection cards for QuickSetup step 0.
 */

import React from 'react';
import { TouchableOpacity, Animated, View, StyleSheet } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import { AI_PRESETS, ACP_PRESETS } from './presets';
import type { useQuickSetupWizard } from './useQuickSetupWizard';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step0PresetsProps {
  w: WizardState;
  colors: ThemeColors;
}

export function Step0Presets({ w, colors }: Step0PresetsProps) {
  const isFirstOnboarding = !w.isEditing && w.servers.length === 0;
  let cardIndex = 0;

  return (
    <YStack gap={Spacing.xs}>
      <YStack alignItems="center" gap={Spacing.xs} marginBottom={Spacing.sm}>
        {isFirstOnboarding ? (
          <Text fontSize={28} fontWeight="700" color={colors.text}>
            Benvenuto 👋
          </Text>
        ) : (
          <Text fontSize={24} fontWeight="700" color={colors.text}>
            {w.isEditing ? 'Modifica server' : 'Aggiungi server'}
          </Text>
        )}
        <Text fontSize={FontSize.footnote} textAlign="center" color={colors.textTertiary}>
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
            style={{ opacity: w.cardAnims[idx], transform: [{ translateY: w.cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
          >
            <TouchableOpacity
              style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
              onPress={() => w.handlePresetSelect(preset)}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" gap={Spacing.sm}>
                <preset.icon size={20} color={colors.primary} />
                <Text fontSize={FontSize.body} fontWeight="600" color={colors.text} flex={1}>
                  {preset.label}
                </Text>
                <ChevronRight size={16} color={colors.textTertiary} />
              </XStack>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Agent CLI presets */}
      <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary} textTransform="uppercase" letterSpacing={0.5} marginTop={Spacing.xs}>
        Agent CLI (ACP)
      </Text>
      {ACP_PRESETS.map(preset => {
        const idx = cardIndex++;
        return (
          <Animated.View
            key={preset.label}
            style={{ opacity: w.cardAnims[idx], transform: [{ translateY: w.cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
          >
            <TouchableOpacity
              style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
              onPress={() => w.handleACPSelect(preset)}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" gap={Spacing.sm}>
                <preset.icon size={20} color={colors.primary} />
                <Text fontSize={FontSize.body} fontWeight="600" color={colors.text} flex={1}>
                  {preset.label}
                </Text>
                <ChevronRight size={16} color={colors.textTertiary} />
              </XStack>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Skip + Advanced */}
      <XStack justifyContent="space-between" marginTop={Spacing.xs}>
        {w.servers.length > 0 && (
          <TouchableOpacity style={styles.advancedLink} onPress={() => w.navigation.goBack()}>
            <XStack alignItems="center" gap={4}>
              <ChevronLeft size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
                Torna alla chat
              </Text>
            </XStack>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.advancedLink} onPress={() => w.navigation.navigate('AddServer')}>
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
}

const styles = StyleSheet.create({
  compactCard: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  advancedLink: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
});
