/**
 * Typing indicator — ChatGPT style: 3 staggered pulsing dots with avatar.
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { XStack, Text, YStack } from 'tamagui';
import { Sparkles } from 'lucide-react-native';
import { useDesignSystem, layout } from '../utils/designSystem';
import { Spacing } from '../utils/theme';

const dotStyle = { width: 6, height: 6, borderRadius: 3 } as const;
const DOT_DELAYS = [0, 150, 300];

function useStaggeredDot(delay: number) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [anim, delay]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return { opacity, transform: [{ scale }] };
}

export const TypingIndicator = React.memo(function TypingIndicator() {
  const { ds } = useDesignSystem();
  const dot0 = useStaggeredDot(DOT_DELAYS[0]);
  const dot1 = useStaggeredDot(DOT_DELAYS[1]);
  const dot2 = useStaggeredDot(DOT_DELAYS[2]);
  const dots = [dot0, dot1, dot2];

  return (
    <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.md} style={ds.bgAssistantMessage}>
      <XStack alignItems="center" gap={Spacing.md}>
        <YStack style={ds.avatar}>
          <Sparkles size={16} color="#FFFFFF" />
        </YStack>
        <XStack alignItems="center" gap={4}>
          {dots.map((style, i) => (
            <Animated.View key={i} style={[dotStyle, ds.bgSystemGray5, style]} />
          ))}
        </XStack>
        <Text style={ds.textSecondary} fontSize={13}>is thinking...</Text>
      </XStack>
    </YStack>
  );
});
