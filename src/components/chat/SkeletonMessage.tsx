/**
 * SkeletonMessage — shimmer placeholder shown while AI response starts streaming.
 * Uses react-native-reanimated for a smooth shimmer effect.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import { Sparkles } from 'lucide-react-native';
import { useDesignSystem } from '../../utils/designSystem';
import { Spacing, Radius } from '../../utils/theme';

const SHIMMER_DURATION = 1200;

function ShimmerBar({ width, height = 12 }: { width: number | string; height?: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.bar,
        animStyle,
        { width: width as number, height, borderRadius: height / 2 },
      ]}
    />
  );
}

export const SkeletonMessage = React.memo(function SkeletonMessage() {
  const { ds } = useDesignSystem();

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <YStack paddingHorizontal={Spacing.lg} paddingVertical={Spacing.md} style={ds.bgAssistantMessage}>
        <XStack alignItems="flex-start" gap={Spacing.md}>
          <YStack style={ds.avatar}>
            <Sparkles size={16} color="#FFFFFF" />
          </YStack>
          <YStack flex={1} gap={8}>
            <ShimmerBar width="85%" height={12} />
            <ShimmerBar width="65%" height={12} />
            <ShimmerBar width="40%" height={12} />
          </YStack>
        </XStack>
      </YStack>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
});
