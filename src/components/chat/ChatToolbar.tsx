/**
 * ChatToolbar — compact horizontal action bar above the composer.
 * Consolidates all chat actions: server, templates, A/B, voice, search,
 * export, terminal, screen watcher, agent mode, consensus.
 */

import React, { useCallback, useRef } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { XStack, Text } from 'tamagui';
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
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

interface Props {
  colors: ThemeColors;
  /** Server selection */
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  /** Chat actions */
  onOpenTemplates: () => void;
  onOpenModelPicker: () => void;
  currentModelLabel: string;
  onToggleAB: () => void;
  abActive: boolean;
  onToggleVoice?: () => void;
  isListening?: boolean;
  onToggleSearch: () => void;
  searchActive: boolean;
  onExport: () => void;
  hasMessages: boolean;
  /** Feature toggles (moved from header) */
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

const ICON_SIZE = 16;

export const ChatToolbar = React.memo(function ChatToolbar({
  colors,
  servers,
  selectedServerId,
  onSelectServer,
  onOpenTemplates,
  onOpenModelPicker,
  currentModelLabel,
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
    // ── Chat actions ──
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
    // ── Feature toggles (from header) ──
    {
      id: 'terminal',
      icon: <TerminalIcon size={ICON_SIZE} color={terminalActive ? colors.primary : colors.textSecondary} />,
      label: 'Term',
      active: terminalActive,
      onPress: onOpenTerminal,
    },
    {
      id: 'watcher',
      icon: <Eye size={ICON_SIZE} color={screenWatcherActive ? colors.destructive || '#EF4444' : colors.textSecondary} />,
      label: 'Watch',
      active: screenWatcherActive,
      onPress: onOpenScreenWatcher,
    },
    {
      id: 'agent',
      icon: <Bot size={ICON_SIZE} color={agentActive ? colors.primary : colors.textSecondary} />,
      label: 'Agent',
      active: agentActive,
      onPress: onToggleAgent,
    },
    {
      id: 'consensus',
      icon: <Scale size={ICON_SIZE} color={consensusActive ? colors.primary : colors.textSecondary} />,
      label: 'Consensus',
      active: consensusActive,
      onPress: onToggleConsensus,
      onLongPress: onConsensusLongPress,
    },
  ];

  return (
    <XStack
      paddingHorizontal={Spacing.sm}
      paddingVertical={5}
      alignItems="center"
      gap={4}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor={colors.separator}
    >
      {/* Server chip — always first */}
      {servers.length >= 2 && (
        <>
          <ServerChip
            servers={servers}
            selected={selectedServer}
            accent={serverAccent}
            colors={colors}
            onSelect={onSelectServer}
          />
          <Separator color={colors.separator} />
        </>
      )}

      {/* Provider•Model chip */}
      <TouchableOpacity
        onPress={onOpenModelPicker}
        activeOpacity={0.7}
        style={{
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: colors.codeBackground,
          maxWidth: 160,
        }}
      >
        <Text fontSize={11} fontWeight="500" color={colors.textSecondary} numberOfLines={1}>
          {currentModelLabel || 'Model'}
        </Text>
      </TouchableOpacity>
      <Separator color={colors.separator} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((action, i) => (
          <React.Fragment key={action.id}>
            <ToolbarButton action={action} colors={colors} />
            {(action.id === 'ab' || action.id === 'export') && i < actions.length - 1 && (
              <Separator color={colors.separator} />
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </XStack>
  );
});

/** Thin vertical separator between action groups */
const Separator = React.memo(function Separator({ color }: { color: string }) {
  return (
    <View style={[styles.separator, { backgroundColor: color }]} />
  );
});

/** Animated toolbar icon button with press scale + haptic */
const ToolbarButton = React.memo(function ToolbarButton({
  action,
  colors,
}: {
  action: ToolbarAction;
  colors: ThemeColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action.onPress();
  }, [action]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={action.onLongPress}
        delayLongPress={400}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={action.disabled}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        accessibilityLabel={action.label}
        accessibilityRole="button"
        accessibilityState={{ selected: action.active, disabled: action.disabled }}
        style={[
          styles.button,
          action.active && { backgroundColor: `${colors.primary}18` },
          action.disabled && { opacity: 0.35 },
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
    </Animated.View>
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
    paddingRight: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    marginHorizontal: 4,
    opacity: 0.5,
  },
});
