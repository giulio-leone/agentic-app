/**
 * SessionListItem — Single session row in the HomeScreen list.
 */
import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { Text } from 'tamagui';
import { SessionSummary } from '../../acp/models/types';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  session: SessionSummary;
  isSelected: boolean;
  onPress: (session: SessionSummary) => void;
  onLongPress: (id: string) => void;
  colors: { cardBackground: string; primary: string; text: string; textTertiary: string };
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
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
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
      <Text color={colors.text} fontSize={FontSize.body} flex={1} numberOfLines={1}>
        {session.title || 'New Session'}
      </Text>
      {session.updatedAt && (
        <Text color={colors.textTertiary} fontSize={FontSize.caption} marginLeft={Spacing.sm}>
          {new Date(session.updatedAt).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );
});
