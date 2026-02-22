/**
 * Layout tokens — theme-independent flex, spacing, and positioning primitives.
 */

import { StyleSheet } from 'react-native';
import { Spacing } from './theme';

export const layout = StyleSheet.create({
  // Flex
  flex1: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  flexShrink: { flexShrink: 1 },
  flexWrap: { flexWrap: 'wrap' },

  // Direction
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  rowReverse: { flexDirection: 'row-reverse' },

  // Alignment
  center: { justifyContent: 'center', alignItems: 'center' },
  centerH: { alignItems: 'center' },
  centerV: { justifyContent: 'center' },
  spaceBetween: { justifyContent: 'space-between' },
  alignStart: { alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  selfCenter: { alignSelf: 'center' },
  selfEnd: { alignSelf: 'flex-end' },

  // Spacing (padding)
  pXs: { padding: Spacing.xs },
  pSm: { padding: Spacing.sm },
  pMd: { padding: Spacing.md },
  pLg: { padding: Spacing.lg },
  pXl: { padding: Spacing.xl },
  pXxl: { padding: Spacing.xxl },
  phXs: { paddingHorizontal: Spacing.xs },
  phSm: { paddingHorizontal: Spacing.sm },
  phMd: { paddingHorizontal: Spacing.md },
  phLg: { paddingHorizontal: Spacing.lg },
  phXl: { paddingHorizontal: Spacing.xl },
  pvXs: { paddingVertical: Spacing.xs },
  pvSm: { paddingVertical: Spacing.sm },
  pvMd: { paddingVertical: Spacing.md },
  pvLg: { paddingVertical: Spacing.lg },
  pvXl: { paddingVertical: Spacing.xl },

  // Spacing (margin)
  mXs: { margin: Spacing.xs },
  mSm: { margin: Spacing.sm },
  mMd: { margin: Spacing.md },
  mLg: { margin: Spacing.lg },
  mhXs: { marginHorizontal: Spacing.xs },
  mhSm: { marginHorizontal: Spacing.sm },
  mhMd: { marginHorizontal: Spacing.md },
  mhLg: { marginHorizontal: Spacing.lg },
  mvXs: { marginVertical: Spacing.xs },
  mvSm: { marginVertical: Spacing.sm },
  mvMd: { marginVertical: Spacing.md },
  mvLg: { marginVertical: Spacing.lg },

  // Gaps (via marginRight on children or gap on parent RN ≥ 0.71)
  gapXs: { gap: Spacing.xs },
  gapSm: { gap: Spacing.sm },
  gapMd: { gap: Spacing.md },
  gapLg: { gap: Spacing.lg },
  gapXl: { gap: Spacing.xl },

  // Positioning
  absolute: { position: 'absolute' },
  relative: { position: 'relative' },
  fullAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overflowHidden: { overflow: 'hidden' },

  // Sizing
  fullWidth: { width: '100%' },
  fullHeight: { height: '100%' },

  // Borders
  hairline: { borderWidth: StyleSheet.hairlineWidth },
  borderTop: { borderTopWidth: StyleSheet.hairlineWidth },
  borderBottom: { borderBottomWidth: StyleSheet.hairlineWidth },
});
