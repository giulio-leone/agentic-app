/**
 * ServerListItem — Single server row in the HomeScreen list.
 */
import React, { useCallback } from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { YStack, Text } from 'tamagui';
import { ConnectionBadge } from '../ConnectionBadge';
import { ACPConnectionState, ACPServerConfiguration } from '../../acp/models/types';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  server: ACPServerConfiguration;
  isSelected: boolean;
  connectionState: ACPConnectionState;
  isInitialized: boolean;
  onPress: (id: string) => void;
  colors: { cardBackground: string; primary: string; text: string; textTertiary: string };
}

export const ServerListItem = React.memo(function ServerListItem({
  server, isSelected, connectionState, isInitialized, onPress, colors,
}: Props) {
  const handlePress = useCallback(() => onPress(server.id), [onPress, server.id]);
  return (
    <TouchableOpacity
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
          marginHorizontal: Spacing.lg,
          marginVertical: 2,
          backgroundColor: colors.cardBackground,
          borderRadius: Radius.md,
          ...Platform.select({ android: { elevation: 1 } }),
        },
        isSelected && { backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: colors.primary },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Server: ${server.name || server.host}`}
    >
      <YStack flex={1} marginRight={Spacing.sm}>
        <Text color={colors.text} fontSize={FontSize.body} fontWeight="500" numberOfLines={1}>
          {server.name || server.host}
        </Text>
        <Text color={colors.textTertiary} fontSize={FontSize.caption} marginTop={2} numberOfLines={1}>
          {server.scheme}://{server.host}
        </Text>
      </YStack>
      {isSelected && (
        <ConnectionBadge state={connectionState} isInitialized={isInitialized} />
      )}
    </TouchableOpacity>
  );
});
