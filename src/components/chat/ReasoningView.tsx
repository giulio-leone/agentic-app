/**
 * ReasoningView — Collapsible reasoning/thinking display.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Brain } from 'lucide-react-native';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { sharedStyles } from '../../utils/sharedStyles';

interface Props {
  reasoning: string;
  colors: ThemeColors;
  isStreaming: boolean;
}

export const ReasoningView = React.memo(function ReasoningView({ reasoning, colors, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(isStreaming);
  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);
  const { lines, preview } = useMemo(() => ({
    lines: reasoning.split('\n').length,
    preview: reasoning.length > 120 ? reasoning.substring(0, 120) + '…' : reasoning,
  }), [reasoning]);

  return (
    <TouchableOpacity
      style={[sharedStyles.separatorCard, { marginBottom: Spacing.xs, borderColor: colors.separator, backgroundColor: colors.codeBackground }]}
      onPress={toggleExpanded}
      activeOpacity={0.7}
    >
      <XStack alignItems="center" gap={6}>
        <Brain size={16} color={colors.primary} />
        <Text fontSize={FontSize.footnote} fontWeight="500" flex={1} color={colors.textSecondary}>
          {isStreaming ? 'Thinking…' : `Thought for ${lines} lines`}
        </Text>
        {isStreaming && <ActivityIndicator size="small" color={colors.primary} />}
        <Text fontSize={14} fontWeight="600" paddingLeft={4} color={colors.textTertiary}>
          {expanded ? '▾' : '▸'}
        </Text>
      </XStack>
      {expanded ? (
        <Text fontSize={FontSize.footnote} lineHeight={20} marginTop={8} fontFamily="monospace" color={colors.textTertiary} selectable>
          {reasoning}
        </Text>
      ) : !isStreaming ? (
        <Text fontSize={FontSize.caption} marginTop={4} fontStyle="italic" color={colors.textTertiary} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});
