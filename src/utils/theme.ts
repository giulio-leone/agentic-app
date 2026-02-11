/**
 * Theme system with adaptive dark/light mode support.
 * Inspired by ChatGPT & Claude's refined aesthetic.
 */

import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

// ─── Color Palettes ───

const LightPalette = {
  // Brand
  primary: '#2563EB',
  primaryMuted: 'rgba(37,99,235,0.10)',
  healthyGreen: '#22C55E',
  destructive: '#EF4444',
  orange: '#F59E0B',
  yellow: '#EAB308',

  // System grays
  secondaryLabel: '#6B7280',
  tertiaryLabel: '#9CA3AF',
  systemGray6: '#F3F4F6',
  systemGray5: '#E5E7EB',
  systemGray4: '#D1D5DB',
  systemGray3: '#9CA3AF',
  systemGray2: '#6B7280',
  systemGray: '#4B5563',

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  cardBackground: '#FFFFFF',
  separator: 'rgba(0,0,0,0.08)',

  // Text
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',

  // Chat
  userBubble: '#2563EB',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#F3F4F6',
  assistantBubbleText: '#111827',
  inputBackground: '#F3F4F6',

  // Sidebar
  sidebarBackground: '#F9FAFB',
  sidebarHeader: '#FFFFFF',
  sidebarItem: '#FFFFFF',
  sidebarItemActive: 'rgba(37,99,235,0.08)',

  // Code & special
  codeBackground: '#F3F4F6',
  codeText: '#1F2937',
  toolCallBackground: '#EFF6FF',
  thoughtBackground: 'rgba(234,179,8,0.08)',

  statusBarStyle: 'dark' as 'dark' | 'light',
};

const DarkPalette: typeof LightPalette = {
  // Brand
  primary: '#3B82F6',
  primaryMuted: 'rgba(59,130,246,0.15)',
  healthyGreen: '#34D399',
  destructive: '#F87171',
  orange: '#FBBF24',
  yellow: '#FCD34D',

  // System grays
  secondaryLabel: '#9CA3AF',
  tertiaryLabel: '#6B7280',
  systemGray6: '#1F2937',
  systemGray5: '#374151',
  systemGray4: '#4B5563',
  systemGray3: '#6B7280',
  systemGray2: '#9CA3AF',
  systemGray: '#D1D5DB',

  // Surfaces — warm dark, NOT pure black
  background: '#0F172A',
  surface: '#1E293B',
  cardBackground: '#1E293B',
  separator: 'rgba(255,255,255,0.08)',

  // Text
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#64748B',

  // Chat
  userBubble: '#3B82F6',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#1E293B',
  assistantBubbleText: '#E2E8F0',
  inputBackground: '#1E293B',

  // Sidebar
  sidebarBackground: '#0F172A',
  sidebarHeader: '#1E293B',
  sidebarItem: '#1E293B',
  sidebarItemActive: 'rgba(59,130,246,0.15)',

  // Code & special
  codeBackground: '#1E293B',
  codeText: '#E2E8F0',
  toolCallBackground: 'rgba(59,130,246,0.10)',
  thoughtBackground: 'rgba(252,211,77,0.10)',

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
  return useMemo(() => ({
    colors: colorScheme === 'dark' ? DarkPalette : LightPalette,
    dark: colorScheme === 'dark',
  }), [colorScheme]);
}
