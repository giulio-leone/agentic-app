/**
 * VoiceWaveform — Animated audio waveform bars shown during voice recording.
 * Uses react-native-reanimated for smooth 60fps bar animations.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
} from 'react-native-reanimated';

const BAR_COUNT = 5;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MAX_HEIGHT = 24;
const MIN_HEIGHT = 4;
const DURATION = 400;

function WaveBar({ index, color }: { index: number; color: string }) {
  const height = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    height.value = withDelay(
      index * 80,
      withRepeat(
        withTiming(MAX_HEIGHT, { duration: DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    return () => { cancelAnimation(height); };
  }, [height, index]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[styles.bar, animStyle, { backgroundColor: color }]}
    />
  );
}

interface Props {
  color: string;
  visible: boolean;
}

export const VoiceWaveform = React.memo(function VoiceWaveform({ color, visible }: Props) {
  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.container}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <WaveBar key={i} index={i} color={color} />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
    height: MAX_HEIGHT,
    paddingHorizontal: 4,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    minHeight: MIN_HEIGHT,
  },
});
