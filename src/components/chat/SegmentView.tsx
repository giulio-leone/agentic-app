/**
 * SegmentView — Renders a single message segment (text, tool call, thought).
 */

import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import Markdown from 'react-native-markdown-display';
import type { MessageSegment } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { codeBlockRules } from './codeBlockRules';

interface Props {
  segment: MessageSegment;
  colors: ThemeColors;
  isUser: boolean;
  mdStyles: Record<string, unknown>;
}

export const SegmentView = React.memo(function SegmentView({ segment, colors, isUser, mdStyles }: Props) {
  const [expanded, setExpanded] = useState(false);

  switch (segment.type) {
    case 'text':
      return isUser ? (
        <Text fontSize={FontSize.body} lineHeight={24} color={colors.userBubbleText} selectable>
          {segment.content}
        </Text>
      ) : (
        <Markdown style={mdStyles as any} rules={codeBlockRules}>{segment.content}</Markdown>
      );

    case 'toolCall': {
      const total = segment.callCount ?? 1;
      const completed = segment.completedCount ?? (segment.isComplete ? total : 0);
      const showCount = total > 1;
      return (
        <TouchableOpacity
          style={{ borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.sm, marginVertical: 4, borderColor: colors.separator }}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <XStack alignItems="center" gap={8}>
            <Text fontSize={16} color={colors.textTertiary}>
              {segment.isComplete ? '🔧' : '⏳'}
            </Text>
            <YStack flex={1}>
              <XStack alignItems="center" gap={6}>
                <Text fontWeight="600" fontSize={FontSize.footnote} fontFamily="monospace" color={colors.textSecondary}>{segment.toolName}</Text>
                {showCount && (
                  <Text fontSize={11} fontWeight="600" paddingHorizontal={6} paddingVertical={1} borderRadius={8} backgroundColor={colors.separator} color={colors.textSecondary}>
                    ×{total}
                  </Text>
                )}
              </XStack>
              <Text fontSize={11} color={colors.textTertiary}>
                {segment.isComplete
                  ? (showCount ? `${completed}/${total} completed` : 'Completed')
                  : (showCount ? `${completed}/${total} completed` : 'Running…')}
              </Text>
            </YStack>
            {!segment.isComplete && <ActivityIndicator size="small" color={colors.primary} />}
            {segment.isComplete && <Text fontSize={14} color={colors.healthyGreen}>✓</Text>}
            <Text fontSize={14} fontWeight="600" paddingLeft={4} color={colors.textTertiary}>
              {expanded ? '▾' : '▸'}
            </Text>
          </XStack>
          {expanded && (
            <YStack marginTop={8} gap={4}>
              <Text fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} color={colors.textTertiary}>Latest Input:</Text>
              <Text fontFamily="monospace" fontSize={FontSize.caption} padding={Spacing.sm} borderRadius={4} maxHeight={200} overflow="hidden" color={colors.codeText} backgroundColor={colors.codeBackground} selectable>
                {segment.input}
              </Text>
              {segment.result && (
                <>
                  <Text fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} color={colors.textTertiary}>Latest Result:</Text>
                  <Text fontFamily="monospace" fontSize={FontSize.caption} padding={Spacing.sm} borderRadius={4} maxHeight={200} overflow="hidden" color={colors.codeText} backgroundColor={colors.codeBackground} selectable>
                    {segment.result.substring(0, 1000)}
                    {segment.result.length > 1000 ? '…' : ''}
                  </Text>
                </>
              )}
            </YStack>
          )}
        </TouchableOpacity>
      );
    }

    case 'thought':
      return (
        <TouchableOpacity
          style={{ marginVertical: 4, padding: Spacing.sm }}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textTertiary}>
            {expanded ? '▾ Thinking' : '▸ Thinking…'}
          </Text>
          {expanded && (
            <Text fontSize={FontSize.footnote} lineHeight={20} marginTop={4} color={colors.textTertiary} selectable>
              {segment.content}
            </Text>
          )}
        </TouchableOpacity>
      );

    case 'agentEvent':
      return (
        <XStack alignItems="center" gap={6} paddingVertical={3}>
          <Text fontSize={FontSize.caption} color={colors.textTertiary}>
            {segment.label}
          </Text>
        </XStack>
      );

    default:
      return null;
  }
});
