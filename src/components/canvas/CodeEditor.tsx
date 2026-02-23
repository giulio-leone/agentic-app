/**
 * CodeEditor — Syntax-highlighted code viewer with inline editing.
 * Uses the existing CodeBlock for display and a TextInput overlay for editing.
 */

import React, { useState, useCallback, useRef } from 'react';
import { TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Edit3, Eye, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { CodeBlock } from '../CodeBlock';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { sharedStyles } from '../../utils/sharedStyles';

interface Props {
  content: string;
  language?: string;
  colors: ThemeColors;
  onContentChange?: (content: string) => void;
}

export const CodeEditor = React.memo(function CodeEditor({ content, language, colors, onContentChange }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const { copied, triggerCopy } = useCopyFeedback();
  const inputRef = useRef<TextInput>(null);

  const toggleEdit = useCallback(() => {
    if (isEditing && editText !== content) {
      onContentChange?.(editText);
    }
    setIsEditing(!isEditing);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isEditing, editText, content, onContentChange]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(isEditing ? editText : content);
    triggerCopy();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isEditing, editText, content, triggerCopy]);

  return (
    <YStack flex={1}>
      {/* Toolbar */}
      <XStack
        paddingHorizontal={Spacing.sm}
        paddingVertical={Spacing.xs}
        gap={Spacing.sm}
        justifyContent="flex-end"
        alignItems="center"
      >
        {language && (
          <Text fontSize={11} color={colors.textTertiary} textTransform="uppercase" flex={1}>
            {language}
          </Text>
        )}
        <TouchableOpacity onPress={handleCopy} style={styles.toolBtn}>
          {copied ? <Check size={14} color={colors.primary} /> : <Copy size={14} color={colors.textSecondary} />}
        </TouchableOpacity>
        {onContentChange && (
          <TouchableOpacity
            onPress={toggleEdit}
            style={[styles.toolBtn, isEditing && { backgroundColor: colors.primary + '20' }]}
          >
            {isEditing ? (
              <Eye size={14} color={colors.primary} />
            ) : (
              <Edit3 size={14} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </XStack>

      {/* Content */}
      {isEditing ? (
        <ScrollView style={sharedStyles.flex1} keyboardShouldPersistTaps="handled">
          <TextInput
            ref={inputRef}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            style={[
              styles.editor,
              {
                color: colors.codeText,
                backgroundColor: colors.codeBackground,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
          />
        </ScrollView>
      ) : (
        <ScrollView style={sharedStyles.flex1}>
          <CodeBlock code={content} language={language} />
        </ScrollView>
      )}
    </YStack>
  );
});

const styles = StyleSheet.create({
  toolBtn: {
    padding: 6,
    borderRadius: Radius.sm,
  },
  editor: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: Spacing.md,
    minHeight: 300,
  },
});
