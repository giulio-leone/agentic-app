/**
 * Empty state for the chat — pulsing icon, staggered chip entrance, fade-in.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, Pressable } from 'react-native';
import { YStack, Text } from 'tamagui';
import { MessageSquare, Code, Lightbulb, Zap, Wifi, WifiOff } from 'lucide-react-native';
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
  width: 52, height: 52, borderRadius: 26,
  justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
} as const;

export const ChatEmptyState = React.memo(function ChatEmptyState({
  isConnected,
  colors,
  onSuggestion,
}: ChatEmptyStateProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const chipAnims = useRef(SUGGESTION_CHIPS.map(() => new Animated.Value(0))).current;

  // Fade-in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Pulse icon
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => { anim.stop(); pulseAnim.setValue(1); };
  }, [pulseAnim]);

  // Staggered chip entrance
  useEffect(() => {
    if (!isConnected) return;
    const anims = chipAnims.map((anim, i) =>
      Animated.timing(anim, { toValue: 1, duration: 300, delay: 200 + i * 80, useNativeDriver: true }),
    );
    const parallel = Animated.parallel(anims);
    parallel.start();
    return () => { parallel.stop(); chipAnims.forEach(a => a.setValue(0)); };
  }, [isConnected, chipAnims]);

  const iconStyle = useMemo(
    () => [iconBaseStyle, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }],
    [colors.primary, pulseAnim],
  );

  const pressHandlers = useMemo(
    () => SUGGESTION_CHIPS.map(chip => () => onSuggestion(chip.prompt)),
    [onSuggestion],
  );

  return (
    <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
      <YStack alignItems="center" gap={Spacing.md} paddingHorizontal={Spacing.xxl}>
        <Animated.View style={iconStyle}>
          {isConnected
            ? <Text fontSize={22} color={colors.contrastText}>✦</Text>
            : <WifiOff size={22} color={colors.contrastText} />}
        </Animated.View>
        <Text fontSize={FontSize.title3} fontWeight="700" color={colors.text}>
          {isConnected ? 'How can I help?' : 'Not connected'}
        </Text>
        <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
          {isConnected
            ? 'Start typing or pick a suggestion below'
            : 'Open the sidebar to connect to a server'}
        </Text>
        {!isConnected && (
          <Wifi size={14} color={colors.textTertiary} style={{ marginTop: 4 }} />
        )}
        {isConnected && (
          <YStack gap={Spacing.xs} marginTop={Spacing.md} width="100%" maxWidth={320}>
            {SUGGESTION_CHIPS.map((chip, i) => (
              <Animated.View key={chip.text} style={{ opacity: chipAnims[i], transform: [{ translateY: chipAnims[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
                <Pressable
                  onPress={pressHandlers[i]}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm + 2,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: colors.separator,
                    backgroundColor: colors.cardBackground,
                  })}
                  accessibilityLabel={chip.text}
                  accessibilityRole="button"
                >
                  <chip.icon size={16} color={colors.primary} />
                  <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.text}>{chip.text}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </YStack>
        )}
      </YStack>
    </Animated.View>
  );
});
