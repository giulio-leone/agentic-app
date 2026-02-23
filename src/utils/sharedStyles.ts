/**
 * Shared style primitives — reusable across forms, buttons, and cards.
 * Import these instead of duplicating inline style objects.
 */

/** Shared hitSlop constants for TouchableOpacity/Pressable */
export const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 } as const;

import { StyleSheet } from 'react-native';
import { Spacing, Radius } from './theme';

export const sharedStyles = StyleSheet.create({
  formInput: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  pillButton: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  card: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  separatorCard: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  listContentPadBottom40: {
    paddingBottom: 40,
  },
});
