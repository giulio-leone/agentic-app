/**
 * Message composer — ChatGPT style: pill-shaped input with glass bottom bar.
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
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme, FontSize, Spacing } from '../utils/theme';

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
  placeholder = 'Message',
}: Props) {
  const { colors, dark } = useTheme();
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

  const content = (
    <View style={[styles.inner, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
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
            style={[styles.cancelButton, { backgroundColor: colors.text }]}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <View style={[styles.stopIcon, { backgroundColor: colors.background }]} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: canSend ? colors.sendButtonBg : colors.sendButtonDisabledBg },
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Text style={[styles.sendIcon, { color: canSend ? colors.sendButtonIcon : colors.textTertiary }]}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Glass effect on iOS, solid on Android
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={80} tint={dark ? 'dark' : 'light'} style={styles.container}>
        {content}
      </BlurView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: dark ? 'rgba(33,33,33,0.95)' : 'rgba(255,255,255,0.95)' }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
  },
  inner: {
    paddingHorizontal: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs + 2,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    minHeight: 48,
    borderWidth: 1,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -1,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});
