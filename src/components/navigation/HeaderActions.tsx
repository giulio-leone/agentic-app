/**
 * HeaderActions — minimal right-side header: just New Chat button.
 * All other actions moved to ChatToolbar.
 */

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { XStack } from 'tamagui';
import { PenLine } from 'lucide-react-native';
import { Spacing } from '../../utils/theme';
import { HIT_SLOP_8 } from '../../utils/sharedStyles';
import type { ThemeColors } from '../../utils/theme';

interface HeaderActionsProps {
  colors: ThemeColors;
  isInitialized: boolean;
  onCreateSession: () => void;
}

export const HeaderActions = React.memo(function HeaderActions({
  colors,
  isInitialized,
  onCreateSession,
}: HeaderActionsProps) {
  return (
    <XStack alignItems="center">
      <TouchableOpacity
        onPress={onCreateSession}
        style={{ paddingHorizontal: Spacing.md }}
        hitSlop={HIT_SLOP_8}
        accessibilityLabel="New chat"
        accessibilityRole="button"
      >
        <PenLine size={20} color={colors.text} opacity={isInitialized ? 1 : 0.3} />
      </TouchableOpacity>
    </XStack>
  );
});
