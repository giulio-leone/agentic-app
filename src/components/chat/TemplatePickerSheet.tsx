/**
 * TemplatePickerSheet — bottom sheet with categorized prompt templates.
 * Supports built-in + user-created templates with add/edit/delete.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { YStack, XStack, Text } from 'tamagui';
import { Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { v4 as uuidv4 } from 'uuid';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { HIT_SLOP_8 } from '../../utils/sharedStyles';
import type { PromptTemplate } from '../../utils/promptTemplates';
import { PromptLibrary } from '../../storage/PromptLibrary';
import { TemplateEditor } from './TemplateEditor';
import { ITEM_LAYOUT_60, keyExtractorById } from '../../utils/listUtils';

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
  const [userTemplates, setUserTemplates] = useState<PromptTemplate[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);

  // Load user templates when sheet opens
  useEffect(() => {
    if (visible) {
      PromptLibrary.getAll().then(setUserTemplates);
    }
  }, [visible]);

  const allTemplates = useMemo(() => [...templates, ...userTemplates], [templates, userTemplates]);

  const filtered = useMemo(() =>
    category === 'all' ? allTemplates : allTemplates.filter(t => t.category === category),
    [allTemplates, category],
  );

  const categoryHandlers = useMemo(
    () => Object.fromEntries(CATEGORIES.map(c => [c.key, () => setCategory(c.key)])),
    [],
  );

  const handleSaveTemplate = useCallback(async (data: Omit<PromptTemplate, 'id' | 'isBuiltIn'> & { id?: string }) => {
    const template: PromptTemplate = {
      id: data.id || uuidv4(),
      title: data.title,
      prompt: data.prompt,
      category: data.category,
      icon: data.icon,
      isBuiltIn: false,
    };
    await PromptLibrary.save(template);
    setUserTemplates(await PromptLibrary.getAll());
  }, []);

  const handleDeleteTemplate = useCallback((template: PromptTemplate) => {
    Alert.alert('Delete Template', `Delete "${template.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await PromptLibrary.remove(template.id);
          setUserTemplates(await PromptLibrary.getAll());
        },
      },
    ]);
  }, []);

  const renderItem = useCallback(({ item }: { item: PromptTemplate }) => (
    <TouchableOpacity
      onPress={() => { onSelect(item); onClose(); }}
      onLongPress={() => {
        if (!item.isBuiltIn) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(item.title, 'What would you like to do?', [
            { text: 'Edit', onPress: () => { setEditingTemplate(item); setEditorVisible(true); } },
            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTemplate(item) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }
      }}
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
          <XStack gap={Spacing.xs} alignItems="center">
            <Text fontSize={FontSize.caption} color={colors.primary}>Custom</Text>
            <TouchableOpacity
              onPress={() => handleDeleteTemplate(item)}
              hitSlop={HIT_SLOP_8}
            >
              <Trash2 size={14} color={colors.destructive} />
            </TouchableOpacity>
          </XStack>
        )}
      </XStack>
    </TouchableOpacity>
  ), [colors, onSelect, onClose, handleDeleteTemplate]);

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

          <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={Spacing.lg} marginBottom={Spacing.sm}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
              Prompt Templates
            </Text>
            <TouchableOpacity
              onPress={() => { setEditingTemplate(null); setEditorVisible(true); }}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              hitSlop={HIT_SLOP_8}
            >
              <Plus size={16} color="#FFF" />
            </TouchableOpacity>
          </XStack>

          {/* Category tabs */}
          <XStack paddingHorizontal={Spacing.md} marginBottom={Spacing.sm} gap={Spacing.xs}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={categoryHandlers[cat.key]}
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
            keyExtractor={keyExtractorById}
            renderItem={renderItem}
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
            getItemLayout={ITEM_LAYOUT_60}
            removeClippedSubviews
          />
        </Animated.View>
      </Pressable>

      <TemplateEditor
        visible={editorVisible}
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onClose={() => setEditorVisible(false)}
        colors={colors}
      />
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
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

