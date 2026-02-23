/**
 * SegmentView — Renders a single message segment (text, tool call, thought).
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Wrench, Loader, Check, ChevronDown, ChevronRight, Terminal, FileEdit } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { StyleSheet } from 'react-native';
import type { MessageSegment } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { sharedStyles } from '../../utils/sharedStyles';
import { codeBlockRules } from './codeBlockRules';

const segStyles = StyleSheet.create({
  thoughtBtn: { marginVertical: 4, padding: Spacing.sm },
  agentEventBtn: { marginVertical: 2, paddingVertical: 3, paddingHorizontal: Spacing.xs },
});

interface Props {
  segment: MessageSegment;
  colors: ThemeColors;
  isUser: boolean;
  mdStyles: StyleSheet.NamedStyles<Record<string, unknown>>;
}

export const SegmentView = React.memo(function SegmentView({ segment, colors, isUser, mdStyles }: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);

  switch (segment.type) {
    case 'text':
      return isUser ? (
        <Text fontSize={FontSize.body} lineHeight={24} color={colors.userBubbleText} selectable>
          {segment.content}
        </Text>
      ) : (
        <Markdown style={mdStyles} rules={codeBlockRules}>{segment.content}</Markdown>
      );

    case 'toolCall': {
      const total = segment.callCount ?? 1;
      const completed = segment.completedCount ?? (segment.isComplete ? total : 0);
      const showCount = total > 1;
      return (
        <TouchableOpacity
          style={[sharedStyles.separatorCard, { marginVertical: 4, borderColor: colors.separator }]}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <XStack alignItems="center" gap={8}>
            {segment.isComplete
              ? <Wrench size={15} color={colors.textTertiary} />
              : <Loader size={15} color={colors.primary} />}
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
            {segment.isComplete && <Check size={15} color={colors.healthyGreen} />}
            {expanded ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />}
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
          style={segStyles.thoughtBtn}
          onPress={toggleExpanded}
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

    case 'agentEvent': {
      const isTerminal = segment.eventType.startsWith('terminal_');
      const isFile = segment.eventType.startsWith('file_');
      const hasDetail = !!segment.detail;
      const Icon = isTerminal ? Terminal : isFile ? FileEdit : null;

      if (!hasDetail) {
        return (
          <XStack alignItems="center" gap={6} paddingVertical={3}>
            {Icon && <Icon size={12} color={colors.textTertiary} />}
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              {segment.label}
            </Text>
          </XStack>
        );
      }

      return (
        <TouchableOpacity
          style={segStyles.agentEventBtn}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <XStack alignItems="center" gap={6}>
            {Icon && <Icon size={12} color={colors.textTertiary} />}
            <Text fontSize={FontSize.caption} color={colors.textTertiary} flex={1}>
              {segment.label}
            </Text>
            {expanded
              ? <ChevronDown size={12} color={colors.textTertiary} />
              : <ChevronRight size={12} color={colors.textTertiary} />}
          </XStack>
          {expanded && (
            <YStack marginTop={4}>
              <Text
                fontFamily="monospace"
                fontSize={11}
                padding={Spacing.xs}
                borderRadius={4}
                maxHeight={150}
                overflow="hidden"
                color={colors.codeText}
                backgroundColor={colors.codeBackground}
                selectable
              >
                {formatEventDetail(segment.detail, segment.eventType)}
              </Text>
            </YStack>
          )}
        </TouchableOpacity>
      );
    }

    default:
      return null;
  }
});

/** Format event detail JSON into readable text based on event type. */
function formatEventDetail(detail: string | undefined, eventType: string): string {
  if (!detail) return '';
  try {
    const data = JSON.parse(detail);
    if (eventType === 'terminal_command') {
      const cmd = data.name || data.command || '';
      const args = data.data?.args || '';
      return args ? `$ ${cmd} ${args}` : `$ ${cmd}`;
    }
    if (eventType === 'terminal_output') {
      const output = data.output || '';
      const stderr = data.data?.stderr || '';
      return stderr ? `${output}\n\nstderr:\n${stderr}` : output;
    }
    if (eventType === 'file_edit') {
      const path = data.name || data.path || '';
      const action = data.data?.action || 'modified';
      return `${action}: ${path}`;
    }
    if (eventType === 'reasoning') {
      return data.output || data.content || JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data, null, 2);
  } catch { /* JSON parse failed — render truncated text */
    return detail.substring(0, 500);
  }
}
