/**
 * ChatSearchBar — In-chat search with result navigation.
 * Shows match count and prev/next buttons to jump between results.
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { XStack, Text } from 'tamagui';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react-native';
import type { ThemeColors } from '../../utils/theme';
import { Spacing, FontSize, Radius } from '../../utils/theme';

interface Props {
  visible: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  onClose: () => void;
  matchCount: number;
  currentMatch: number;
  onPrev: () => void;
  onNext: () => void;
  colors: ThemeColors;
}

export const ChatSearchBar = React.memo(function ChatSearchBar({
  visible,
  query,
  onChangeQuery,
  onClose,
  matchCount,
  currentMatch,
  onPrev,
  onNext,
  colors,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    onChangeQuery('');
    onClose();
  }, [onChangeQuery, onClose]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(150)}>
    <XStack
      paddingHorizontal={Spacing.sm}
      paddingVertical={Spacing.xs}
      backgroundColor={colors.cardBackground}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor={colors.separator}
      alignItems="center"
      gap={Spacing.xs}
    >
      <Search size={16} color={colors.textTertiary} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }]}
        placeholder="Search messages..."
        placeholderTextColor={colors.textTertiary}
        value={query}
        onChangeText={onChangeQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search messages"
      />
      {query.length > 0 && (
        <Text fontSize={FontSize.caption} color={colors.textTertiary} minWidth={40} textAlign="center">
          {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : '0'}
        </Text>
      )}
      <TouchableOpacity onPress={onPrev} disabled={matchCount === 0} style={styles.navBtn} hitSlop={8} accessibilityLabel="Previous match" accessibilityRole="button">
        <ChevronUp size={18} color={matchCount > 0 ? colors.text : colors.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} disabled={matchCount === 0} style={styles.navBtn} hitSlop={8} accessibilityLabel="Next match" accessibilityRole="button">
        <ChevronDown size={18} color={matchCount > 0 ? colors.text : colors.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleClose} style={styles.navBtn} hitSlop={8} accessibilityLabel="Close search" accessibilityRole="button">        <X size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </XStack>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  navBtn: {
    padding: 4,
  },
});
