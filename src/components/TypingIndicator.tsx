/**
 * Typing indicator — enhanced bounce animation with 3 dots and status text.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { XStack, Text, YStack } from 'tamagui';
import { Sparkles } from 'lucide-react-native';
import { useDesignSystem, layout } from '../utils/designSystem';
import { Spacing } from '../utils/theme';

const DOT_SIZE = 7;
const dotStyle = { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 } as const;
const DOT_DELAYS = [0, 160, 320];

function useBounceDot(delay: number) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(200),
        ]),
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [anim, delay]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.1, 0.8] });
  return { opacity, transform: [{ translateY }, { scale }] };
}

export const TypingIndicator = React.memo(function TypingIndicator() {
  const { ds } = useDesignSystem();
  const dot0 = useBounceDot(DOT_DELAYS[0]!);
  const dot1 = useBounceDot(DOT_DELAYS[1]!);
  const dot2 = useBounceDot(DOT_DELAYS[2]!);
  const dots = [dot0, dot1, dot2];

  return (
    <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.md} style={ds.bgAssistantMessage}>
      <XStack alignItems="center" gap={Spacing.md}>
        <YStack style={ds.avatar}>
          <Sparkles size={16} color="#FFFFFF" />
        </YStack>
        <XStack alignItems="center" gap={5}>
          {dots.map((style, i) => (
            <Animated.View key={i} style={[dotStyle, ds.bgSystemGray5, style]} />
          ))}
        </XStack>
        <Text style={ds.textSecondary} fontSize={13}>is thinking…</Text>
      </XStack>
    </YStack>
  );
});
