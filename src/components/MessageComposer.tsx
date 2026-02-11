/**
 * Message composer — themed, with haptic feedback.
 */

import React, { useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, FontSize, Spacing, Radius } from '../utils/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  isStreaming: boolean;
  isDisabled: boolean;
  placeholder?: string;
}

export function MessageComposer({
  value,
  onChangeText,
  onSend,
  onCancel,
  isStreaming,
  isDisabled,
  placeholder = 'Message the agent…',
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0 && !isStreaming && !isDisabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend();
  }, [canSend, onSend]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel?.();
  }, [onCancel]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.separator, paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.systemGray2}
          multiline
          maxLength={10000}
          editable={!isDisabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        {isStreaming ? (
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.destructive }]}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: canSend ? colors.primary : colors.systemGray4 },
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: Radius.xl + 2,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs + 2,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.body,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 2 : Spacing.xs,
    paddingBottom: 0,
    lineHeight: 22,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -1,
  },
  cancelButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
