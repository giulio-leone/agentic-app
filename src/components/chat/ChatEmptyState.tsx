/**
 * Empty state for the chat — pulsing icon, title, suggestion chips.
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Animated, Pressable } from 'react-native';
import { YStack, Text } from 'tamagui';
import { MessageSquare, Code, Lightbulb, Zap } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface ChatEmptyStateProps {
  isConnected: boolean;
  colors: Record<string, string>;
  onSuggestion: (prompt: string) => void;
}

const SUGGESTION_CHIPS = [
  { icon: MessageSquare, text: 'Explain this code', prompt: 'Explain this code to me step by step' },
  { icon: Code, text: 'Write a function', prompt: 'Write a function that ' },
  { icon: Lightbulb, text: 'Help me brainstorm', prompt: 'Help me brainstorm ideas for ' },
  { icon: Zap, text: 'Debug an error', prompt: 'I have this error: ' },
] as const;

const iconBaseStyle = {
  width: 48, height: 48, borderRadius: 24,
  justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
} as const;

export const ChatEmptyState = React.memo(function ChatEmptyState({
  isConnected,
  colors,
  onSuggestion,
}: ChatEmptyStateProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    );
    pulseRef.current = anim;
    anim.start();
    return () => { anim.stop(); pulseAnim.setValue(1); };
  }, [pulseAnim]);

  const iconStyle = useMemo(
    () => [iconBaseStyle, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }],
    [colors.primary, pulseAnim],
  );

  const handlePress = useCallback((prompt: string) => () => onSuggestion(prompt), [onSuggestion]);

  return (
    <YStack alignItems="center" gap={Spacing.md} paddingHorizontal={Spacing.xxl}>
      <Animated.View style={iconStyle}>
        <Text fontSize={22} color={colors.contrastText}>✦</Text>
      </Animated.View>
      <Text fontSize={FontSize.title3} fontWeight="600" color={colors.text}>
        {isConnected ? 'How can I help you today?' : 'Not connected'}
      </Text>
      <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
        {isConnected
          ? 'Type a message to start a conversation'
          : 'Open the sidebar to connect to a server'}
      </Text>
      {isConnected && (
        <YStack gap={Spacing.xs} marginTop={Spacing.md} width="100%" maxWidth={320}>
          {SUGGESTION_CHIPS.map((chip) => (
            <Pressable
              key={chip.text}
              onPress={handlePress(chip.prompt)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.sm,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: colors.separator,
                backgroundColor: colors.cardBackground,
              })}
              accessibilityLabel={chip.text}
              accessibilityRole="button"
            >
              <chip.icon size={16} color={colors.primary} />
              <Text fontSize={FontSize.footnote} color={colors.text}>{chip.text}</Text>
            </Pressable>
          ))}
        </YStack>
      )}
    </YStack>
  );
});
