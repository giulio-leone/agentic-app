/**
 * SessionListItem — Single session row with swipe-left-to-delete gesture.
 */
import React, { useRef, useCallback } from 'react';
import { TouchableOpacity, Platform, StyleSheet, View } from 'react-native';
import { Text, XStack } from 'tamagui';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle, FadeIn } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SessionSummary } from '../../acp/models/types';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  session: SessionSummary;
  isSelected: boolean;
  onPress: (session: SessionSummary) => void;
  onDelete: (id: string) => void;
  colors: { cardBackground: string; primary: string; text: string; textTertiary: string };
}

/** Formats a date as relative time (e.g. "2h ago", "3d ago"). */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const DELETE_THRESHOLD = 80;

const RenderRightActions = React.memo(function RenderRightActions({ drag }: { drag: SharedValue<number> }) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(drag.value) / DELETE_THRESHOLD),
    transform: [{ scale: Math.min(1, Math.abs(drag.value) / DELETE_THRESHOLD) }],
  }));

  return (
    <View style={styles.deleteContainer}>
      <Animated.View style={[styles.deleteIcon, animStyle]}>
        <Trash2 size={20} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
});

export const SessionListItem = React.memo(function SessionListItem({
  session, isSelected, onPress, onDelete, colors,
}: Props) {
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const handleSwipeOpen = useCallback((direction: string) => {
    if (direction === 'right') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDelete(session.id);
      swipeRef.current?.close();
    }
  }, [onDelete, session.id]);

  const renderRight = useCallback(
    (_progress: SharedValue<number>, drag: SharedValue<number>) => <RenderRightActions drag={drag} />,
    [],
  );

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <ReanimatedSwipeable
        ref={swipeRef}
        renderRightActions={renderRight}
        rightThreshold={DELETE_THRESHOLD}
        onSwipeableOpen={handleSwipeOpen}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[
            {
              paddingHorizontal: Spacing.lg,
              paddingVertical: Spacing.md,
              marginHorizontal: Spacing.lg,
              marginVertical: 2,
              backgroundColor: colors.cardBackground,
              borderRadius: Radius.md,
              ...Platform.select({ android: { elevation: 1 } }),
            },
            isSelected && { backgroundColor: `${colors.primary}15` },
          ]}
          onPress={() => onPress(session)}
          activeOpacity={0.7}
          accessibilityLabel={`Session: ${session.title || 'New Session'}`}
        >
          <XStack justifyContent="space-between" alignItems="center">
            <Text color={colors.text} fontSize={FontSize.body} flex={1} numberOfLines={1}>
              {session.title || 'New Session'}
            </Text>
            {session.updatedAt && (
              <Text color={colors.textTertiary} fontSize={FontSize.caption} marginLeft={Spacing.sm}>
                {timeAgo(session.updatedAt)}
              </Text>
            )}
          </XStack>
          {session.cwd && (
            <Text
              color={colors.textTertiary}
              fontSize={FontSize.caption}
              numberOfLines={1}
              marginTop={2}
            >
              {session.cwd}
            </Text>
          )}
        </TouchableOpacity>
      </ReanimatedSwipeable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  deleteContainer: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: DELETE_THRESHOLD,
    borderRadius: Radius.md,
    marginVertical: 2,
  },
  deleteIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
