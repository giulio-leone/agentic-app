/**
 * ChatToolbar — compact horizontal action bar above the composer.
 * Consolidates: server selector, templates, A/B testing, voice, search, export, canvas.
 */

import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { XStack, Text } from 'tamagui';
import {
  PenLine,
  GitCompareArrows,
  Mic,
  Search,
  Share2,
  Layers,
  Server,
} from 'lucide-react-native';
import { FontSize, Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { getServerColor } from '../../utils/serverColors';
import type { ACPServerConfiguration } from '../../acp/models/types';

interface ToolbarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface Props {
  colors: ThemeColors;
  /** Server selection */
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  /** Actions */
  onOpenTemplates: () => void;
  onToggleAB: () => void;
  abActive: boolean;
  onToggleVoice?: () => void;
  isListening?: boolean;
  onToggleSearch: () => void;
  searchActive: boolean;
  onExport: () => void;
  hasMessages: boolean;
}

const ICON_SIZE = 16;

export const ChatToolbar = React.memo(function ChatToolbar({
  colors,
  servers,
  selectedServerId,
  onSelectServer,
  onOpenTemplates,
  onToggleAB,
  abActive,
  onToggleVoice,
  isListening,
  onToggleSearch,
  searchActive,
  onExport,
  hasMessages,
}: Props) {
  const selectedServer = servers.find(s => s.id === selectedServerId);
  const serverAccent = selectedServerId ? getServerColor(selectedServerId) : colors.primary;

  const actions: ToolbarAction[] = [
    {
      id: 'templates',
      icon: <PenLine size={ICON_SIZE} color={colors.textSecondary} />,
      label: 'Templates',
      onPress: onOpenTemplates,
    },
    {
      id: 'ab',
      icon: <GitCompareArrows size={ICON_SIZE} color={abActive ? colors.primary : colors.textSecondary} />,
      label: 'A/B',
      active: abActive,
      onPress: onToggleAB,
    },
    ...(onToggleVoice
      ? [{
          id: 'voice',
          icon: <Mic size={ICON_SIZE} color={isListening ? colors.destructive || '#EF4444' : colors.textSecondary} />,
          label: 'Voice',
          active: isListening,
          onPress: onToggleVoice,
        }]
      : []),
    {
      id: 'search',
      icon: <Search size={ICON_SIZE} color={searchActive ? colors.primary : colors.textSecondary} />,
      label: 'Search',
      active: searchActive,
      onPress: onToggleSearch,
    },
    {
      id: 'export',
      icon: <Share2 size={ICON_SIZE} color={hasMessages ? colors.textSecondary : colors.textTertiary} />,
      label: 'Export',
      disabled: !hasMessages,
      onPress: onExport,
    },
  ];

  return (
    <XStack
      paddingHorizontal={Spacing.sm}
      paddingVertical={4}
      alignItems="center"
      gap={Spacing.xs}
    >
      {/* Server chip — always first */}
      {servers.length >= 2 && (
        <ServerChip
          servers={servers}
          selected={selectedServer}
          accent={serverAccent}
          colors={colors}
          onSelect={onSelectServer}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map(action => (
          <ToolbarButton key={action.id} action={action} colors={colors} />
        ))}
      </ScrollView>
    </XStack>
  );
});

/** Single toolbar icon button */
const ToolbarButton = React.memo(function ToolbarButton({
  action,
  colors,
}: {
  action: ToolbarAction;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={action.onPress}
      disabled={action.disabled}
      activeOpacity={0.6}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityState={{ selected: action.active, disabled: action.disabled }}
      style={[
        styles.button,
        action.active && { backgroundColor: `${colors.primary}15` },
        action.disabled && { opacity: 0.4 },
      ]}
    >
      {action.icon}
      <Text
        fontSize={11}
        fontWeight={action.active ? '600' : '400'}
        color={action.active ? colors.primary : colors.textSecondary}
        numberOfLines={1}
      >
        {action.label}
      </Text>
    </TouchableOpacity>
  );
});

/** Compact server chip with cycling on tap */
const ServerChip = React.memo(function ServerChip({
  servers,
  selected,
  accent,
  colors,
  onSelect,
}: {
  servers: ACPServerConfiguration[];
  selected?: ACPServerConfiguration;
  accent: string;
  colors: ThemeColors;
  onSelect: (id: string) => void;
}) {
  const cycleServer = () => {
    if (servers.length < 2 || !selected) return;
    const idx = servers.findIndex(s => s.id === selected.id);
    const next = servers[(idx + 1) % servers.length];
    onSelect(next.id);
  };

  return (
    <TouchableOpacity
      onPress={cycleServer}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityLabel={`Server: ${selected?.name ?? 'None'}`}
      accessibilityRole="button"
    >
      <XStack
        alignItems="center"
        gap={4}
        paddingHorizontal={Spacing.sm}
        paddingVertical={4}
        borderRadius={Radius.full}
        borderWidth={1}
        borderColor={accent}
        backgroundColor={`${accent}15`}
      >
        <XStack width={6} height={6} borderRadius={3} backgroundColor={accent} />
        <Text fontSize={11} fontWeight="600" color={accent} numberOfLines={1}>
          {selected?.name ?? 'Server'}
        </Text>
      </XStack>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
});
