/**
 * Typing indicator — ChatGPT style: pulsing dot with avatar.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useDesignSystem, layout } from '../utils/designSystem';
import { Spacing } from '../utils/theme';

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
    <View style={[styles.container, ds.bgAssistantMessage]}>
      <View style={[layout.row, layout.centerH, layout.gapMd]}>
        <View style={ds.avatar}>
          <Text style={ds.avatarIcon}>✦</Text>
        </View>
        <Animated.View style={[styles.dot, ds.bgSystemGray5, { opacity: pulse }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
