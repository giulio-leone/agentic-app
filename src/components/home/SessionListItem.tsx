/**
 * SessionListItem — Single session row in the HomeScreen list.
 */
import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { Text, XStack } from 'tamagui';
import { SessionSummary } from '../../acp/models/types';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  session: SessionSummary;
  isSelected: boolean;
  onPress: (session: SessionSummary) => void;
  onLongPress: (id: string) => void;
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

export const SessionListItem = React.memo(function SessionListItem({
  session, isSelected, onPress, onLongPress, colors,
}: Props) {
  return (
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
      onLongPress={() => onLongPress(session.id)}
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
  );
});
