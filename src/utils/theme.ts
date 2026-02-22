/**
 * Theme system — ChatGPT-inspired design language.
 * Dark sidebar always, clean full-width messages, minimal decoration.
 */

import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

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
  systemGray6: '#2F2F2F',
  systemGray5: '#424242',
  systemGray4: '#424242',
  systemGray3: '#6B7280',
  systemGray2: '#8E8EA0',
  systemGray: '#D1D5DB',

  // Surfaces — ChatGPT dark
  background: '#212121',
  surface: '#212121',
  cardBackground: '#2F2F2F',
  separator: 'rgba(255,255,255,0.08)',

  // Text
  text: '#ECECEC',
  textSecondary: '#D1D5DB',
  textTertiary: '#8E8EA0',

  // Chat — full-width, no bubbles
  userBubble: '#2F2F2F',
  userBubbleText: '#ECECEC',
  assistantBubble: '#212121',
  assistantBubbleText: '#ECECEC',
  userMessageBg: '#2F2F2F',
  assistantMessageBg: '#212121',
  inputBackground: '#2F2F2F',
  inputBorder: '#424242',

  // Sidebar — always dark
  sidebarBackground: '#171717',
  sidebarHeader: '#171717',
  sidebarItem: 'transparent',
  sidebarItemActive: 'rgba(255,255,255,0.10)',
  sidebarText: '#ECECF1',
  sidebarTextSecondary: '#8E8EA0',
  sidebarSeparator: 'rgba(255,255,255,0.08)',

  // Code & special
  codeBackground: '#2F2F2F',
  codeText: '#ECECEC',
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

export type ThemeColors = typeof LightPalette;

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
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  // Theme mode from store (if available) — uses lazy require to avoid circular imports
  let themeMode: 'system' | 'light' | 'dark' = 'system';
  try {
    const { useAppStore } = require('../stores/appStore');
    themeMode = useAppStore((s: any) => s.themeMode) ?? 'system';
  } catch { /* store not ready yet */ }

  return useMemo(() => {
    const effective = themeMode === 'system' ? colorScheme : themeMode;
    return {
      colors: effective === 'dark' ? DarkPalette : LightPalette,
      dark: effective === 'dark',
    };
  }, [colorScheme, themeMode]);
}
