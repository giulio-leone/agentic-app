/**
 * ServerChipSelector — horizontal scrollable chip bar above the composer.
 * Tap a chip to select which server handles the next message.
 */

import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { XStack, Text } from 'tamagui';
import { getServerColor } from '../../utils/serverColors';
import { FontSize, Spacing, Radius, type ThemeColors } from '../../utils/theme';
import type { ACPServerConfiguration } from '../../acp/models/types';

interface Props {
  servers: ACPServerConfiguration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  colors: ThemeColors;
}

export const ServerChipSelector = React.memo(function ServerChipSelector({
  servers,
  selectedId,
  onSelect,
  colors,
}: Props) {
  if (servers.length < 2) return null;

  return (
    <XStack
      paddingHorizontal={Spacing.md}
      paddingVertical={Spacing.xs}
      borderTopWidth={0.5}
      borderTopColor={colors.separator}
      backgroundColor={colors.background}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap={Spacing.xs}>
          {servers.map(server => {
            const isActive = server.id === selectedId;
            const accent = getServerColor(server.id);
            return (
              <Chip
                key={server.id}
                label={server.name}
                accent={accent}
                isActive={isActive}
                colors={colors}
                onPress={() => onSelect(server.id)}
              />
            );
          })}
        </XStack>
      </ScrollView>
    </XStack>
  );
});

interface ChipProps {
  label: string;
  accent: string;
  isActive: boolean;
  colors: ThemeColors;
  onPress: () => void;
}

const Chip = React.memo(function Chip({ label, accent, isActive, colors, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityLabel={`Server: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <XStack
        alignItems="center"
        gap={Spacing.xs}
        paddingHorizontal={Spacing.sm}
        paddingVertical={4}
        borderRadius={Radius.full}
        borderWidth={1.5}
        borderColor={isActive ? accent : colors.separator}
        backgroundColor={isActive ? `${accent}18` : 'transparent'}
      >
        <XStack
          width={8}
          height={8}
          borderRadius={4}
          backgroundColor={accent}
        />
        <Text
          fontSize={FontSize.caption}
          fontWeight={isActive ? '600' : '400'}
          color={isActive ? accent : colors.textSecondary}
          numberOfLines={1}
        >
          {label}
        </Text>
      </XStack>
    </TouchableOpacity>
  );
});
