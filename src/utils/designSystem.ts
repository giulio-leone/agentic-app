/**
 * Design System — Single Source of Truth (SSOT)
 *
 * All composable style primitives for the entire app.
 * Components import from here instead of creating inline styles.
 *
 * Usage:
 *   const { ds } = useDesignSystem();
 *   <Text style={ds.textBody}>Hello</Text>
 *   <View style={ds.card}>...</View>
 *   <View style={[ds.row, ds.gap.md]}>...</View>
 */

import { StyleSheet, Platform } from 'react-native';
import { useTheme, type ThemeColors, Spacing, FontSize, Radius } from './theme';
import { useMemo } from 'react';

// ─── Static Layout Tokens (theme-independent) ───

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

  // Margin
  mXs: { margin: Spacing.xs },
  mSm: { margin: Spacing.sm },
  mMd: { margin: Spacing.md },
  mLg: { margin: Spacing.lg },
  mhSm: { marginHorizontal: Spacing.sm },
  mhMd: { marginHorizontal: Spacing.md },
  mhLg: { marginHorizontal: Spacing.lg },
  mvSm: { marginVertical: Spacing.sm },
  mvMd: { marginVertical: Spacing.md },
  mvLg: { marginVertical: Spacing.lg },
  mtXs: { marginTop: Spacing.xs },
  mtSm: { marginTop: Spacing.sm },
  mtMd: { marginTop: Spacing.md },
  mtLg: { marginTop: Spacing.lg },
  mbXs: { marginBottom: Spacing.xs },
  mbSm: { marginBottom: Spacing.sm },
  mbMd: { marginBottom: Spacing.md },
  mbLg: { marginBottom: Spacing.lg },

  // Gap
  gapXs: { gap: Spacing.xs },
  gapSm: { gap: Spacing.sm },
  gapMd: { gap: Spacing.md },
  gapLg: { gap: Spacing.lg },
  gapXl: { gap: Spacing.xl },

  // Border radius
  roundSm: { borderRadius: Radius.sm },
  roundMd: { borderRadius: Radius.md },
  roundLg: { borderRadius: Radius.lg },
  roundXl: { borderRadius: Radius.xl },
  roundFull: { borderRadius: Radius.full },

  // Width / height
  wFull: { width: '100%' },
  hFull: { height: '100%' },
  minH44: { minHeight: 44 },

  // Position
  absolute: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFillObject },

  // Misc
  overflow: { overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth },
  noSelect: { ...Platform.select({ android: { elevation: 0 } }) },
});

// ─── Static Typography (theme-independent) ───

export const typography = StyleSheet.create({
  // Sizes
  caption: { fontSize: FontSize.caption },
  footnote: { fontSize: FontSize.footnote },
  subheadline: { fontSize: FontSize.subheadline },
  body: { fontSize: FontSize.body },
  headline: { fontSize: FontSize.headline },
  title3: { fontSize: FontSize.title3 },
  title2: { fontSize: FontSize.title2 },
  title1: { fontSize: FontSize.title1 },
  largeTitle: { fontSize: FontSize.largeTitle },

  // Weights
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },

  // Alignment
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },

  // Line heights
  bodyLineHeight: { fontSize: FontSize.body, lineHeight: 24 },

  // Uppercase label
  label: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Ellipsis
  singleLine: { numberOfLines: 1 } as any,
  italic: { fontStyle: 'italic' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});

// ─── Themed Styles (depend on colors) ───

function createThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // ── Text Colors ──
    textPrimary: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    textContrast: { color: colors.contrastText },
    textAccent: { color: colors.primary },
    textDestructive: { color: colors.destructive },

    // ── Background Colors ──
    bgBackground: { backgroundColor: colors.background },
    bgSurface: { backgroundColor: colors.surface },
    bgCard: { backgroundColor: colors.cardBackground },
    bgSystemGray6: { backgroundColor: colors.systemGray6 },
    bgSystemGray5: { backgroundColor: colors.systemGray5 },
    bgPrimary: { backgroundColor: colors.primary },
    bgDestructive: { backgroundColor: colors.destructive },
    bgCode: { backgroundColor: colors.codeBackground },
    bgInput: { backgroundColor: colors.inputBackground },
    bgUserMessage: { backgroundColor: colors.userMessageBg },
    bgAssistantMessage: { backgroundColor: colors.assistantMessageBg },

    // ── Sidebar Colors ──
    textSidebar: { color: colors.sidebarText },
    textSidebarSecondary: { color: colors.sidebarTextSecondary },
    bgSidebar: { backgroundColor: colors.sidebarBackground },
    bgSidebarActive: { backgroundColor: colors.sidebarItemActive },

    // ── Border Colors ──
    borderSeparator: { borderColor: colors.separator },
    borderInput: { borderColor: colors.inputBorder },
    borderPrimary: { borderColor: colors.primary },
    borderDestructive: { borderColor: colors.destructive },

    // ── Separator Line ──
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
    },
    sidebarSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.sidebarSeparator,
    },

    // ── Composable Cards ──
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      overflow: 'hidden' as const,
      ...Platform.select({
        android: { elevation: 1 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
        },
      }),
    },
    cardFlat: {
      backgroundColor: colors.cardBackground,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      overflow: 'hidden' as const,
    },

    // ── Button Styles ──
    buttonPrimary: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center' as const,
    },
    buttonPrimaryText: {
      color: colors.contrastText,
      fontSize: FontSize.body,
      fontWeight: '600',
    },
    buttonDestructive: {
      backgroundColor: colors.destructive,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center' as const,
    },
    buttonOutline: {
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center' as const,
    },

    // ── Chip Styles ──
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.separator,
      gap: 4,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: FontSize.footnote,
      fontWeight: '500',
      color: colors.text,
    },
    chipTextSelected: {
      color: colors.contrastText,
    },

    // ── Form Field Row ──
    fieldRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: Spacing.md,
      minHeight: 44,
    },
    fieldLabel: {
      fontSize: FontSize.body,
      fontWeight: '400',
      color: colors.text,
      width: 90,
    },
    fieldInput: {
      flex: 1,
      fontSize: FontSize.body,
      color: colors.text,
      textAlign: 'right' as const,
      paddingVertical: 0,
    },

    // ── Segmented Control ──
    segmentedControl: {
      flexDirection: 'row' as const,
      backgroundColor: colors.systemGray5,
      borderRadius: Radius.sm,
      padding: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center' as const,
      borderRadius: 6,
    },
    segmentSelected: {
      backgroundColor: colors.cardBackground,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentText: {
      fontSize: FontSize.footnote,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    segmentTextSelected: {
      color: colors.text,
      fontWeight: '600',
    },

    // ── Toggle / Switch Track ──
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 2,
      justifyContent: 'center' as const,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.contrastText,
    },

    // ── Avatar ──
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    avatarIcon: {
      color: colors.contrastText,
      fontSize: 14,
    },

    // ── Radio Button ──
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.systemGray3,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    radioSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.contrastText,
    },

    // ── Badge ──
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.sm,
      backgroundColor: colors.primaryMuted,
    },
    badgeText: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
    },

    // ── Section Header ──
    sectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },

    // ── Card Label (uppercase) ──
    cardLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      color: colors.textTertiary,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },

    // ── Placeholder text color (for TextInput) ──
    placeholderColor: { color: colors.systemGray2 },

    // ── Send Button ──
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.sendButtonBg,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    sendButtonDisabled: {
      backgroundColor: colors.sendButtonDisabledBg,
    },
    sendIcon: {
      color: colors.sendButtonIcon,
      fontSize: 18,
      fontWeight: '700',
    },
  });
}

// ─── Cached hook ───

export type DesignSystemStyles = ReturnType<typeof createThemedStyles>;

export function useDesignSystem() {
  const theme = useTheme();
  const ds = useMemo(() => createThemedStyles(theme.colors), [theme.colors]);
  return { ds, colors: theme.colors, dark: theme.dark, layout, typography };
}
