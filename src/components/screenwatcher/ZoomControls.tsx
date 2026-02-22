/**
 * ZoomControls — Hardware optical zoom buttons + label.
 */
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing } from '../../utils/theme';

const ZOOM_LEVELS = [0.6, 1.0, 3.0, 5.0, 10.0] as const;

interface Props {
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  colors: { textSecondary: string; primary: string; text: string };
  dark: boolean;
}

export const ZoomControls = React.memo(function ZoomControls({ zoomLevel, setZoomLevel, colors, dark }: Props) {
  return (
    <YStack paddingHorizontal={Spacing.xl} gap={Spacing.md}>
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap={4}>
          <Search size={13} color={colors.textSecondary} />
          <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.textSecondary}>
            Hardware Optical Zoom
          </Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="bold">
          {zoomLevel.toFixed(1)}x
        </Text>
      </XStack>

      <XStack justifyContent="center" gap={Spacing.md}>
        {ZOOM_LEVELS.map((z) => (
          <TouchableOpacity
            key={z}
            style={[
              styles.zoomBtn,
              {
                flex: 1,
                backgroundColor:
                  Math.abs(zoomLevel - z) < 0.01
                    ? colors.primary
                    : dark ? '#2F2F2F' : '#E5E7EB',
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setZoomLevel(z);
            }}
          >
            <Text
              fontSize={FontSize.caption}
              fontWeight="600"
              color={Math.abs(zoomLevel - z) < 0.01 ? '#FFF' : colors.text}
            >
              {z === 0.6 ? '.6x' : `${z}x`}
            </Text>
          </TouchableOpacity>
        ))}
      </XStack>
    </YStack>
  );
});

const styles = StyleSheet.create({
  zoomBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 44,
    alignItems: 'center',
  },
});
