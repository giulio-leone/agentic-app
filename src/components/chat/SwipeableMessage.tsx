/**
 * SwipeableMessage — wraps a message with swipe-right-to-quote gesture.
 * Uses ReanimatedSwipeable from gesture-handler for smooth 60fps animation.
 * Swipe right reveals a reply icon; releasing past threshold quotes the message.
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Reply } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '../../utils/theme';
import type { ChatMessage } from '../../acp/models/types';

interface Props {
  children: React.ReactNode;
  message: ChatMessage;
  onSwipeReply: (msg: ChatMessage) => void;
  colors: ThemeColors;
  enabled?: boolean;
}

const TRIGGER_THRESHOLD = 60;

interface LeftActionProps {
  drag: SharedValue<number>;
  colors: ThemeColors;
}

const LeftAction = React.memo(function LeftAction({ drag, colors }: LeftActionProps) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: Math.min(drag.value / TRIGGER_THRESHOLD, 1),
    transform: [{ scale: Math.min(drag.value / TRIGGER_THRESHOLD, 1) }],
  }));

  return (
    <View style={styles.actionContainer}>
      <Animated.View style={[styles.replyIcon, animStyle]}>
        <Reply size={18} color={colors.primary} />
      </Animated.View>
    </View>
  );
});

export const SwipeableMessage = React.memo(function SwipeableMessage({
  children,
  message,
  onSwipeReply,
  colors,
  enabled = true,
}: Props) {
  const swipeRef = useRef<SwipeableMethods | null>(null);
  const didTrigger = useRef(false);

  const handleOpen = useCallback(() => {
    if (!didTrigger.current) {
      didTrigger.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSwipeReply(message);
    }
    // Auto-close after triggering
    swipeRef.current?.close();
  }, [onSwipeReply, message]);

  const handleClose = useCallback(() => {
    didTrigger.current = false;
  }, []);

  const renderLeft = useCallback(
    (_progress: SharedValue<number>, drag: SharedValue<number>) => <LeftAction drag={drag} colors={colors} />,
    [colors],
  );

  if (!enabled) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={TRIGGER_THRESHOLD}
      renderLeftActions={renderLeft}
      onSwipeableOpen={handleOpen}
      onSwipeableClose={handleClose}
      overshootLeft={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  actionContainer: {
    width: TRIGGER_THRESHOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
