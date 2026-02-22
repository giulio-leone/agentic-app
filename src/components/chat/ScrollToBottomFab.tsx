/**
 * ScrollToBottomFab — Animated FAB that appears when user scrolls up.
 * Shows unread message count badge. Tap to scroll to bottom with haptic.
 */

import React from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Text } from 'tamagui';
import { ArrowDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '../../utils/theme';
import { Radius, Spacing } from '../../utils/theme';

interface Props {
  visible: boolean;
  unreadCount: number;
  onPress: () => void;
  colors: ThemeColors;
  opacity: Animated.Value;
}

export const ScrollToBottomFab = React.memo(function ScrollToBottomFab({
  visible,
  unreadCount,
  onPress,
  colors,
  opacity,
}: Props) {
  if (!visible) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <ArrowDown size={18} color={colors.text} />
        {unreadCount > 0 && (
          <Text
            style={[styles.badge, { backgroundColor: colors.primary }]}
            fontSize={10}
            fontWeight="700"
            color={colors.contrastText}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Spacing.md,
    alignSelf: 'center',
    zIndex: 10,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
});
