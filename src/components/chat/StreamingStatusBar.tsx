/**
 * StreamingStatusBar — shows "Generating..." with elapsed time and token count
 * during AI streaming responses.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { XStack, Text } from 'tamagui';
import { Loader2 } from 'lucide-react-native';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing } from '../../utils/theme';

interface StreamingStatusBarProps {
  visible: boolean;
  tokenCount: number;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export const StreamingStatusBar = React.memo(function StreamingStatusBar({
  visible,
  tokenCount,
}: StreamingStatusBarProps) {
  const { colors } = useDesignSystem();
  const [elapsed, setElapsed] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Elapsed timer
  useEffect(() => {
    if (!visible) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  // Spin animation for loader
  useEffect(() => {
    if (!visible) return;
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    spin.start();
    return () => spin.stop();
  }, [visible, spinAnim]);

  if (!visible) return null;

  const rotate = useMemo(
    () => spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [spinAnim],
  );

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <XStack
        paddingVertical={Spacing.xs}
        paddingHorizontal={Spacing.md}
        alignItems="center"
        justifyContent="center"
        gap={Spacing.sm}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Loader2 size={14} color={colors.primary} />
        </Animated.View>
        <Text fontSize={FontSize.caption} color={colors.textTertiary}>
          Generating… {formatElapsed(elapsed)}
        </Text>
        {tokenCount > 0 && (
          <Text fontSize={FontSize.caption} color={colors.textTertiary}>
            · {tokenCount} tokens
          </Text>
        )}
      </XStack>
    </Animated.View>
  );
});
