/**
 * SlashCommandAutocomplete — inline dropdown above composer when typing /.
 */

import React, { useCallback } from 'react';
import { TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { XStack, YStack, Text } from 'tamagui';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { PromptTemplate } from '../../utils/promptTemplates';

interface Props {
  visible: boolean;
  matches: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
  colors: ThemeColors;
}

export const SlashCommandAutocomplete = React.memo(function SlashCommandAutocomplete({
  visible,
  matches,
  onSelect,
  colors,
}: Props) {
  if (!visible || matches.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(150)}
      exiting={FadeOutDown.duration(100)}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.separator }]}
    >
      <FlatList
        data={matches.slice(0, 5)}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
            accessibilityLabel={`Use template: ${item.title}`}
          >
            <XStack paddingHorizontal={Spacing.md} paddingVertical={Spacing.sm} gap={Spacing.sm} alignItems="center">
              <Text fontSize={16}>{item.icon}</Text>
              <YStack flex={1}>
                <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.text}>{item.title}</Text>
              </YStack>
            </XStack>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
        keyboardShouldPersistTaps="handled"
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '100%',
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 240,
    ...({ shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }),
  },
});
