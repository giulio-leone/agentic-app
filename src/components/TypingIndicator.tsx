/**
 * Typing indicator — ChatGPT style: pulsing dot with avatar.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme, Spacing } from '../utils/theme';

export const TypingIndicator = React.memo(function TypingIndicator() {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.assistantMessageBg }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarIcon}>✦</Text>
        </View>
        <Animated.View style={[styles.dot, { backgroundColor: colors.textTertiary, opacity: pulse }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
