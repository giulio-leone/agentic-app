/**
 * Typing indicator — ChatGPT style: pulsing dot with avatar.
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { XStack, Text, YStack } from 'tamagui';
import { useDesignSystem, layout } from '../utils/designSystem';
import { Spacing } from '../utils/theme';

const dotStyle = { width: 8, height: 8, borderRadius: 4 } as const;

export const TypingIndicator = React.memo(function TypingIndicator() {
  const { ds } = useDesignSystem();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.md} style={ds.bgAssistantMessage}>
      <XStack alignItems="center" gap={Spacing.md}>
        <YStack style={ds.avatar}>
          <Text style={ds.avatarIcon}>✦</Text>
        </YStack>
        <Animated.View style={[dotStyle, ds.bgSystemGray5, { opacity: pulse }]} />
      </XStack>
    </YStack>
  );
});
