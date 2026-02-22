/**
 * TemplatePickerSheet — bottom sheet with categorized prompt templates.
 * Opened via slash command autocomplete, template icon, or bottom sheet.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { YStack, XStack, Text } from 'tamagui';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { PromptTemplate } from '../../utils/promptTemplates';

interface Props {
  visible: boolean;
  templates: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
  onClose: () => void;
  colors: ThemeColors;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coding', label: '💻 Code' },
  { key: 'writing', label: '✍️ Writing' },
  { key: 'analysis', label: '🔍 Analysis' },
  { key: 'custom', label: '⭐ Custom' },
] as const;

export const TemplatePickerSheet = React.memo(function TemplatePickerSheet({
  visible,
  templates,
  onSelect,
  onClose,
  colors,
}: Props) {
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() =>
    category === 'all' ? templates : templates.filter(t => t.category === category),
    [templates, category],
  );

  const renderItem = useCallback(({ item }: { item: PromptTemplate }) => (
    <TouchableOpacity
      onPress={() => { onSelect(item); onClose(); }}
      activeOpacity={0.7}
      accessibilityLabel={`Template: ${item.title}`}
      accessibilityRole="button"
    >
      <XStack
        paddingHorizontal={Spacing.lg}
        paddingVertical={Spacing.md}
        gap={Spacing.sm}
        alignItems="center"
      >
        <Text fontSize={20}>{item.icon}</Text>
        <YStack flex={1}>
          <Text fontSize={FontSize.body} fontWeight="500" color={colors.text}>
            {item.title}
          </Text>
          <Text fontSize={FontSize.caption} color={colors.textTertiary} numberOfLines={1}>
            {item.prompt.length > 60 ? item.prompt.slice(0, 60) + '…' : item.prompt}
          </Text>
        </YStack>
        {!item.isBuiltIn && (
          <Text fontSize={FontSize.caption} color={colors.primary}>Custom</Text>
        )}
      </XStack>
    </TouchableOpacity>
  ), [colors, onSelect, onClose]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          {/* Handle */}
          <YStack alignSelf="center" width={36} height={4} borderRadius={2} backgroundColor={colors.systemGray4} marginBottom={Spacing.sm} marginTop={Spacing.sm} />

          <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text} paddingHorizontal={Spacing.lg} marginBottom={Spacing.sm}>
            Prompt Templates
          </Text>

          {/* Category tabs */}
          <XStack paddingHorizontal={Spacing.md} marginBottom={Spacing.sm} gap={Spacing.xs}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: category === cat.key ? colors.primary : 'transparent',
                    borderColor: category === cat.key ? colors.primary : colors.separator,
                  },
                ]}
              >
                <Text
                  fontSize={FontSize.caption}
                  fontWeight={category === cat.key ? '600' : '400'}
                  color={category === cat.key ? '#FFFFFF' : colors.textSecondary}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>

          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  tab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
});
