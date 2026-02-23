/**
 * ChatToolbar — two-row action bar above the composer.
 * Row 1: Model chip (prominent) + server chip.
 * Row 2: Icon-only action buttons in a horizontal scroll.
 */

import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View, Alert } from 'react-native';
import { XStack, YStack, Text } from 'tamagui';
import {
  PenLine,
  GitCompareArrows,
  Mic,
  Search,
  Share2,
  Terminal as TerminalIcon,
  Eye,
  Bot,
  Scale,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { getServerColor } from '../../utils/serverColors';
import type { ACPServerConfiguration } from '../../acp/models/types';

interface ToolbarAction {
  id: string;
  icon: (color: string) => React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

interface Props {
  colors: ThemeColors;
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  onOpenTemplates: () => void;
  onOpenModelPicker: () => void;
  currentModelLabel: string;
  providerIcon: React.ReactNode;
  onToggleAB: () => void;
  abActive: boolean;
  onToggleVoice?: () => void;
  isListening?: boolean;
  onToggleSearch: () => void;
  searchActive: boolean;
  onExport: () => void;
  hasMessages: boolean;
  onOpenTerminal: () => void;
  terminalActive: boolean;
  onOpenScreenWatcher: () => void;
  screenWatcherActive: boolean;
  onToggleAgent: () => void;
  agentActive: boolean;
  onToggleConsensus: () => void;
  onConsensusLongPress: () => void;
  consensusActive: boolean;
}

const ICON = 18;

export const ChatToolbar = React.memo(function ChatToolbar({
  colors,
  servers,
  selectedServerId,
  onSelectServer,
  onOpenTemplates,
  onOpenModelPicker,
  currentModelLabel,
  providerIcon,
  onToggleAB,
  abActive,
  onToggleVoice,
  isListening,
  onToggleSearch,
  searchActive,
  onExport,
  hasMessages,
  onOpenTerminal,
  terminalActive,
  onOpenScreenWatcher,
  screenWatcherActive,
  onToggleAgent,
  agentActive,
  onToggleConsensus,
  onConsensusLongPress,
  consensusActive,
}: Props) {
  const selectedServer = servers.find(s => s.id === selectedServerId);
  const serverAccent = selectedServerId ? getServerColor(selectedServerId) : colors.primary;

  const actions: ToolbarAction[] = [
    {
      id: 'templates',
      icon: (c) => <PenLine size={ICON} color={c} />,
      label: 'Templates',
      onPress: onOpenTemplates,
    },
    {
      id: 'ab',
      icon: (c) => <GitCompareArrows size={ICON} color={c} />,
      label: 'A/B Compare',
      active: abActive,
      onPress: onToggleAB,
    },
    ...(onToggleVoice
      ? [{
          id: 'voice',
          icon: (c: string) => <Mic size={ICON} color={c} />,
          label: 'Voice Input',
          active: isListening,
          onPress: onToggleVoice,
        }]
      : []),
    {
      id: 'search',
      icon: (c) => <Search size={ICON} color={c} />,
      label: 'Search',
      active: searchActive,
      onPress: onToggleSearch,
    },
    {
      id: 'export',
      icon: (c) => <Share2 size={ICON} color={c} />,
      label: 'Export',
      disabled: !hasMessages,
      onPress: onExport,
    },
    {
      id: 'terminal',
      icon: (c) => <TerminalIcon size={ICON} color={c} />,
      label: 'Terminal',
      active: terminalActive,
      onPress: onOpenTerminal,
    },
    {
      id: 'watcher',
      icon: (c) => <Eye size={ICON} color={c} />,
      label: 'Screen Watcher',
      active: screenWatcherActive,
      onPress: onOpenScreenWatcher,
    },
    {
      id: 'agent',
      icon: (c) => <Bot size={ICON} color={c} />,
      label: 'Agent Mode',
      active: agentActive,
      onPress: onToggleAgent,
    },
    {
      id: 'consensus',
      icon: (c) => <Scale size={ICON} color={c} />,
      label: 'Consensus',
      active: consensusActive,
      onPress: onToggleConsensus,
      onLongPress: onConsensusLongPress,
    },
  ];

  return (
    <YStack
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor={colors.separator}
    >
      {/* Row 1 — Model + Server */}
      <XStack
        alignItems="center"
        paddingHorizontal={Spacing.sm}
        paddingTop={6}
        paddingBottom={4}
        gap={Spacing.sm}
      >
        {/* Model chip — hero element, flex takes remaining space */}
        <TouchableOpacity
          onPress={onOpenModelPicker}
          activeOpacity={0.7}
          style={[styles.modelChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, flex: 1 }]}
        >
          {providerIcon ?? null}
          <Text fontSize={14} fontWeight="500" color={colors.primary} numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
            {currentModelLabel || 'Select model'}
          </Text>
          <Text fontSize={10} color={colors.primary} style={{ opacity: 0.6 }}>▾</Text>
        </TouchableOpacity>

        {/* Server chip — right side, does not shrink */}
        {servers.length >= 2 && (
          <ServerChip
            servers={servers}
            selected={selectedServer}
            accent={serverAccent}
            colors={colors}
            onSelect={onSelectServer}
          />
        )}
      </XStack>

      {/* Row 2 — Action icons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map(action => (
          <ActionIcon key={action.id} action={action} colors={colors} />
        ))}
      </ScrollView>
    </YStack>
  );
});

/** Icon-only action button with long-press tooltip */
const ActionIcon = React.memo(function ActionIcon({
  action,
  colors,
}: {
  action: ToolbarAction;
  colors: ThemeColors;
}) {
  const getColor = () => {
    if (action.disabled) return colors.textTertiary;
    if (action.active) {
      // Watcher/voice use destructive color when active
      if (action.id === 'watcher' || action.id === 'voice') return colors.destructive || '#EF4444';
      return colors.primary;
    }
    return colors.textSecondary;
  };

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action.onPress();
  }, [action]);

  const handleLongPress = useCallback(() => {
    if (action.onLongPress) {
      action.onLongPress();
    } else {
      // Show tooltip with label
      Alert.alert(action.label);
    }
  }, [action]);

  const color = getColor();

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      disabled={action.disabled}
      activeOpacity={0.6}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityState={{ selected: action.active, disabled: action.disabled }}
      style={[
        styles.iconButton,
        action.active && { backgroundColor: `${colors.primary}14` },
        action.disabled && { opacity: 0.35 },
      ]}
    >
      {action.icon(color)}
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
        <Text fontSize={12} fontWeight="600" color={accent} numberOfLines={1}>
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
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 6,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
    borderWidth: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
