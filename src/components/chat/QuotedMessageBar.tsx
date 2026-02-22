/**
 * QuotedMessageBar — Shows the quoted/reply message above the composer.
 */
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { FontSize, Spacing } from '../../utils/theme';
import type { ChatMessage } from '../../acp/models/types';

interface Props {
  message: ChatMessage;
  onClear: () => void;
  colors: {
    cardBackground: string;
    separator: string;
    primary: string;
    textSecondary: string;
    textTertiary: string;
  };
}

export const QuotedMessageBar = React.memo(function QuotedMessageBar({ message, onClear, colors }: Props) {
  return (
    <XStack
      paddingHorizontal={Spacing.lg}
      paddingVertical={Spacing.sm}
      backgroundColor={colors.cardBackground}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor={colors.separator}
      alignItems="center"
      gap={Spacing.sm}
    >
      <View style={{ width: 3, height: '100%', backgroundColor: colors.primary, borderRadius: 2, minHeight: 24 }} />
      <YStack flex={1}>
        <Text fontSize={FontSize.caption} fontWeight="600" color={colors.primary}>
          {message.role === 'user' ? 'You' : 'Assistant'}
        </Text>
        <Text fontSize={FontSize.caption} color={colors.textSecondary} numberOfLines={2}>
          {message.content.slice(0, 120)}
        </Text>
      </YStack>
      <Pressable onPress={onClear} hitSlop={8}>
        <Text fontSize={FontSize.body} color={colors.textTertiary}>✕</Text>
      </Pressable>
    </XStack>
  );
});
