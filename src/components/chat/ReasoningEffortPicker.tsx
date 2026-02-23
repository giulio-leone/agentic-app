/**
 * ReasoningEffortPicker — full-screen modal for selecting reasoning effort level.
 * Shown after bridge model selection, or via long-press on the model chip.
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Check, ChevronLeft, Brain } from 'lucide-react-native';
import { Spacing, type ThemeColors } from '../../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  levels: string[];
  selectedLevel: string | null;
  selectedModel: string | null;
  onSelect: (level: string | null) => void;
  colors: ThemeColors;
}

const DESCRIPTIONS: Record<string, string> = {
  default: 'Let the model decide automatically',
  low: 'Fast responses, minimal reasoning',
  medium: 'Balanced speed and reasoning depth',
  high: 'Deep reasoning for complex tasks',
  xhigh: 'Maximum reasoning depth',
};

export const ReasoningEffortPicker = React.memo(function ReasoningEffortPicker({
  visible,
  onClose,
  levels,
  selectedLevel,
  selectedModel,
  onSelect,
  colors,
}: Props) {
  const handleSelect = useCallback((level: string) => {
    onSelect(level === 'default' ? null : level);
    onClose();
  }, [onSelect, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />

        {/* Header */}
        <XStack
          alignItems="center"
          paddingHorizontal={Spacing.sm}
          paddingVertical={8}
          gap={8}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor={colors.separator}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Brain size={20} color={colors.primary} />
          <YStack flex={1}>
            <Text fontSize={17} fontWeight="600" color={colors.text}>Reasoning Effort</Text>
            {selectedModel && (
              <Text fontSize={13} color={colors.textTertiary} numberOfLines={1}>
                {selectedModel}
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Effort levels list */}
        <YStack flex={1} paddingVertical={Spacing.md}>
          {['default', ...levels].map(level => {
            const isActive = level === 'default'
              ? !selectedLevel
              : selectedLevel === level;
            return (
              <TouchableOpacity
                key={level}
                onPress={() => handleSelect(level)}
                style={[
                  styles.row,
                  { borderBottomColor: colors.separator },
                  isActive && { backgroundColor: `${colors.primary}10` },
                ]}
                activeOpacity={0.6}
              >
                <YStack flex={1} gap={2}>
                  <Text
                    fontSize={16}
                    fontWeight={isActive ? '600' : '400'}
                    color={isActive ? colors.primary : colors.text}
                    textTransform="capitalize"
                  >
                    {level}
                  </Text>
                  <Text fontSize={13} color={colors.textTertiary}>
                    {DESCRIPTIONS[level] ?? ''}
                  </Text>
                </YStack>
                {isActive && <Check size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </YStack>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
