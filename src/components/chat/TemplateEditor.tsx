/**
 * TemplateEditor — Modal for creating/editing user prompt templates.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { PromptTemplate } from '../../utils/promptTemplates';

const CATEGORIES = ['coding', 'writing', 'analysis', 'custom'] as const;
const ICONS = ['💡', '📝', '🔧', '🧪', '🎯', '🚀', '📊', '🤖', '🧠', '⚡', '🎨', '🔍'] as const;

interface Props {
  visible: boolean;
  template?: PromptTemplate | null;
  onSave: (template: Omit<PromptTemplate, 'id' | 'isBuiltIn'> & { id?: string }) => void;
  onClose: () => void;
  colors: ThemeColors;
}

export const TemplateEditor = React.memo(function TemplateEditor({ visible, template, onSave, onClose, colors }: Props) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<PromptTemplate['category']>('custom');
  const [icon, setIcon] = useState('💡');

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setPrompt(template.prompt);
      setCategory(template.category);
      setIcon(template.icon);
    } else {
      setTitle('');
      setPrompt('');
      setCategory('custom');
      setIcon('💡');
    }
  }, [template, visible]);

  const canSave = title.trim().length > 0 && prompt.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      ...(template ? { id: template.id } : {}),
      title: title.trim(),
      prompt: prompt.trim(),
      category,
      icon,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <YStack style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Header */}
            <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={Spacing.lg} paddingTop={Spacing.lg}>
              <TouchableOpacity onPress={onClose}>
                <Text fontSize={FontSize.body} color={colors.primary}>Cancel</Text>
              </TouchableOpacity>
              <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
                {template ? 'Edit Template' : 'New Template'}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={!canSave}>
                <Text fontSize={FontSize.body} fontWeight="600" color={canSave ? colors.primary : colors.textTertiary}>
                  Save
                </Text>
              </TouchableOpacity>
            </XStack>

            <YStack padding={Spacing.lg} gap={Spacing.md}>
              {/* Icon picker */}
              <YStack gap={Spacing.xs}>
                <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Icon</Text>
                <XStack flexWrap="wrap" gap={Spacing.xs}>
                  {ICONS.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[
                        styles.iconBtn,
                        { backgroundColor: icon === ic ? colors.primaryMuted : colors.cardBackground },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setIcon(ic); }}
                    >
                      <Text fontSize={20}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </YStack>

              {/* Title */}
              <YStack gap={Spacing.xs}>
                <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Title</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Code Review"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={60}
                />
              </YStack>

              {/* Prompt */}
              <YStack gap={Spacing.xs}>
                <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Prompt</Text>
                <TextInput
                  style={[styles.input, styles.promptInput, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="Use {placeholder} for variables..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                />
              </YStack>

              {/* Category */}
              <YStack gap={Spacing.xs}>
                <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Category</Text>
                <XStack gap={Spacing.xs}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: category === cat ? colors.primary : 'transparent',
                          borderColor: category === cat ? colors.primary : colors.separator,
                        },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setCategory(cat); }}
                    >
                      <Text
                        fontSize={FontSize.caption}
                        fontWeight={category === cat ? '600' : '400'}
                        color={category === cat ? '#FFF' : colors.textSecondary}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </YStack>
            </YStack>
          </ScrollView>
        </YStack>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
  },
  promptInput: {
    minHeight: 120,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
});
