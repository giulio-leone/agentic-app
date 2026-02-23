/**
 * Theme system — ChatGPT-inspired design language.
 * Dark sidebar always, clean full-width messages, minimal decoration.
 */

import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';

// ─── Color Palettes ───

const LightPalette = {
  // Brand — ChatGPT green, no blue primary
  primary: '#10A37F',
  primaryMuted: 'rgba(16,163,127,0.10)',
  healthyGreen: '#10A37F',
  destructive: '#EF4444',
  orange: '#F59E0B',
  yellow: '#EAB308',

  // System grays
  secondaryLabel: '#6B7280',
  tertiaryLabel: '#9CA3AF',
  systemGray6: '#F7F7F8',
  systemGray5: '#E5E7EB',
  systemGray4: '#D9D9E3',
  systemGray3: '#9CA3AF',
  systemGray2: '#8E8EA0',
  systemGray: '#565869',

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  cardBackground: '#FFFFFF',
  separator: 'rgba(0,0,0,0.06)',

  // Text
  text: '#374151',
  textSecondary: '#374151',
  textTertiary: '#6B7280',

  // Chat — full-width, no bubbles
  userBubble: '#F7F7F8',
  userBubbleText: '#374151',
  assistantBubble: '#FFFFFF',
  assistantBubbleText: '#374151',
  userMessageBg: '#F7F7F8',
  assistantMessageBg: '#FFFFFF',
  inputBackground: '#FFFFFF',
  inputBorder: '#D9D9E3',

  // Sidebar — always dark, ChatGPT style
  sidebarBackground: '#202123',
  sidebarHeader: '#202123',
  sidebarItem: 'transparent',
  sidebarItemActive: 'rgba(255,255,255,0.10)',
  sidebarText: '#ECECF1',
  sidebarTextSecondary: '#8E8EA0',
  sidebarSeparator: 'rgba(255,255,255,0.08)',
  sidebarActiveItem: 'rgba(255,255,255,0.10)',
  sidebarSelectedItem: 'rgba(255,255,255,0.06)',
  sidebarInputBg: 'rgba(255,255,255,0.08)',

  // Code & special
  codeBackground: '#F7F7F8',
  codeText: '#1F2937',
  toolCallBackground: 'transparent',
  thoughtBackground: 'transparent',

  // Send button
  sendButtonBg: '#000000',
  sendButtonIcon: '#FFFFFF',
  sendButtonDisabledBg: '#D9D9E3',

  // Contrast text for use on primary/colored backgrounds
  contrastText: '#FFFFFF',

  statusBarStyle: 'dark' as 'dark' | 'light',
};

const DarkPalette: typeof LightPalette = {
  // Brand
  primary: '#10A37F',
  primaryMuted: 'rgba(16,163,127,0.15)',
  healthyGreen: '#10A37F',
  destructive: '#F87171',
  orange: '#FBBF24',
  yellow: '#FCD34D',

  // System grays
  secondaryLabel: '#9CA3AF',
  tertiaryLabel: '#6B7280',
  systemGray6: '#2A2A2A',
  systemGray5: '#3A3A3A',
  systemGray4: '#444444',
  systemGray3: '#6B7280',
  systemGray2: '#8E8EA0',
  systemGray: '#D1D5DB',

  // Surfaces — refined dark
  background: '#1A1A1A',
  surface: '#1A1A1A',
  cardBackground: '#262626',
  separator: 'rgba(255,255,255,0.10)',

  // Text — improved contrast
  text: '#F0F0F0',
  textSecondary: '#D4D4D4',
  textTertiary: '#8E8EA0',

  // Chat — full-width, no bubbles
  userBubble: '#262626',
  userBubbleText: '#F0F0F0',
  assistantBubble: '#1A1A1A',
  assistantBubbleText: '#F0F0F0',
  userMessageBg: '#262626',
  assistantMessageBg: '#1A1A1A',
  inputBackground: '#262626',
  inputBorder: '#3A3A3A',

  // Sidebar — deeper dark
  sidebarBackground: '#141414',
  sidebarHeader: '#141414',
  sidebarItem: 'transparent',
  sidebarItemActive: 'rgba(255,255,255,0.10)',
  sidebarText: '#ECECF1',
  sidebarTextSecondary: '#8E8EA0',
  sidebarSeparator: 'rgba(255,255,255,0.08)',
  sidebarActiveItem: 'rgba(255,255,255,0.10)',
  sidebarSelectedItem: 'rgba(255,255,255,0.06)',
  sidebarInputBg: 'rgba(255,255,255,0.08)',

  // Code & special
  codeBackground: '#262626',
  codeText: '#F0F0F0',
  toolCallBackground: 'transparent',
  thoughtBackground: 'transparent',

  // Send button
  sendButtonBg: '#FFFFFF',
  sendButtonIcon: '#000000',
  sendButtonDisabledBg: '#424242',

  // Contrast text for use on primary/colored backgrounds
  contrastText: '#FFFFFF',

  statusBarStyle: 'light' as const,
};

const AMOLEDPalette: typeof LightPalette = {
  ...DarkPalette,
  // Pure black for AMOLED power saving
  background: '#000000',
  surface: '#000000',
  cardBackground: '#111111',
  systemGray6: '#111111',
  systemGray5: '#1A1A1A',
  userBubble: '#111111',
  assistantBubble: '#000000',
  userMessageBg: '#111111',
  assistantMessageBg: '#000000',
  inputBackground: '#111111',
  inputBorder: '#222222',
  separator: 'rgba(255,255,255,0.06)',
  codeBackground: '#111111',
  sidebarBackground: '#000000',
  sidebarHeader: '#000000',
  sendButtonDisabledBg: '#222222',
  statusBarStyle: 'light' as const,
};

export type ThemeColors = typeof LightPalette;

// ─── Accent Color Presets ───

export const AccentColors = {
  green: '#10A37F',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  cyan: '#06B6D4',
} as const;

export type AccentColorKey = keyof typeof AccentColors;

// ─── Legacy static export (used by files that haven't migrated) ───
export const Colors = LightPalette;

// ─── Spacing ───

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ─── Typography ───

export const FontSize = {
  caption: 12,
  footnote: 13,
  subheadline: 15,
  body: 16,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
};

// ─── Border Radius ───

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// ─── Theme Hook ───

export interface Theme {
  colors: ThemeColors;
  dark: boolean;
  fontScale: number;
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const themeMode = useAppStore((s) => s.themeMode) ?? 'system';
  const accentColor = useAppStore((s) => s.accentColor) ?? 'green';
  const fontScale = useAppStore((s) => s.fontScale) ?? 1.0;

  return useMemo(() => {
    let palette: ThemeColors;
    let dark: boolean;

    if (themeMode === 'amoled') {
      palette = { ...AMOLEDPalette };
      dark = true;
    } else {
      const effective = themeMode === 'system' ? colorScheme : themeMode;
      dark = effective === 'dark';
      palette = dark ? { ...DarkPalette } : { ...LightPalette };
    }

    // Apply accent color
    const accent = AccentColors[accentColor] || AccentColors.green;
    palette.primary = accent;
    palette.primaryMuted = accent + (dark ? '26' : '1A'); // 15% / 10% alpha
    palette.healthyGreen = accent;

    return { colors: palette, dark, fontScale };
  }, [colorScheme, themeMode, accentColor, fontScale]);
}
