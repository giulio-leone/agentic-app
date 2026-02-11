/**
 * Animated typing indicator — three bouncing dots.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../utils/theme';

export function TypingIndicator() {
  const { colors } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.container, { backgroundColor: colors.assistantBubble }]}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: colors.textTertiary, transform: [{ translateY: dot }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 5,
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
