/**
 * StreamingCursor — Blinking inline caret during streaming.
 */
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Spacing } from '../../utils/theme';

interface Props {
  color: string;
}

export const StreamingCursor = React.memo(function StreamingCursor({ color }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 2,
        height: 18,
        backgroundColor: color,
        borderRadius: 1,
        marginTop: Spacing.xs,
        opacity,
      }}
    />
  );
});
