/**
 * HeaderActions — right-side header buttons for the chat screen.
 */

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { XStack } from 'tamagui';
import { Eye, Bot, Scale, PenLine, Search, Terminal as TerminalIcon } from 'lucide-react-native';
import { Spacing } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';

interface HeaderActionsProps {
  colors: ThemeColors;
  isInitialized: boolean;
  agentModeEnabled: boolean;
  consensusModeEnabled: boolean;
  isWatching: boolean;
  terminalVisible: boolean;
  toggleChatSearch: () => void;
  toggleAgentMode: () => void;
  toggleConsensusMode: () => void;
  onConsensusLongPress: () => void;
  onCreateSession: () => void;
  onOpenScreenWatcher: () => void;
  onOpenTerminal: () => void;
}

export function HeaderActions({
  colors,
  isInitialized,
  agentModeEnabled,
  consensusModeEnabled,
  isWatching,
  terminalVisible,
  toggleChatSearch,
  toggleAgentMode,
  toggleConsensusMode,
  onConsensusLongPress,
  onCreateSession,
  onOpenScreenWatcher,
  onOpenTerminal,
}: HeaderActionsProps) {
  return (
    <XStack alignItems="center" gap={Spacing.xs}>
      <TouchableOpacity
        onPress={toggleChatSearch}
        style={{ paddingHorizontal: Spacing.sm }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Search messages"
        accessibilityRole="button"
      >
        <Search size={18} color={colors.text} opacity={0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onOpenTerminal}
        style={{ paddingHorizontal: Spacing.sm }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={terminalVisible ? 'Terminal open' : 'Open terminal'}
        accessibilityRole="button"
      >
        <TerminalIcon size={18} color={terminalVisible ? colors.primary : colors.text} opacity={terminalVisible ? 1 : 0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onOpenScreenWatcher}
        style={{ paddingHorizontal: Spacing.sm }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={isWatching ? 'Screen watcher active' : 'Open screen watcher'}
        accessibilityRole="button"
      >
        <Eye size={18} color={isWatching ? colors.destructive : colors.text} opacity={isWatching ? 1 : 0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleAgentMode}
        style={{ paddingHorizontal: Spacing.sm }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={agentModeEnabled ? 'Disable agent mode' : 'Enable agent mode'}
        accessibilityRole="button"
        accessibilityState={{ selected: agentModeEnabled }}
      >
        <Bot size={18} color={agentModeEnabled ? colors.primary : colors.text} opacity={agentModeEnabled ? 1 : 0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleConsensusMode}
        onLongPress={onConsensusLongPress}
        delayLongPress={400}
        style={{ paddingHorizontal: Spacing.sm }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={consensusModeEnabled ? 'Disable consensus mode' : 'Enable consensus mode'}
        accessibilityRole="button"
        accessibilityState={{ selected: consensusModeEnabled }}
      >
        <Scale size={18} color={consensusModeEnabled ? colors.primary : colors.text} opacity={consensusModeEnabled ? 1 : 0.5} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onCreateSession}
        style={{ paddingHorizontal: Spacing.md }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <PenLine size={20} color={colors.text} opacity={isInitialized ? 1 : 0.3} />
      </TouchableOpacity>
    </XStack>
  );
}
