/**
 * SegmentView — Renders a single message segment (text, tool call, thought).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';
import type { MessageSegment } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { CodeBlock } from '../CodeBlock';

// Custom render rules for syntax-highlighted code blocks
const codeBlockRules: RenderRules = {
  fence: (node: ASTNode) => {
    const lang = (node as ASTNode & { sourceInfo?: string }).sourceInfo || '';
    const code = node.content || '';
    return <CodeBlock key={node.key} code={code.replace(/\n$/, '')} language={lang} />;
  },
  code_block: (node: ASTNode) => {
    const code = node.content || '';
    return <CodeBlock key={node.key} code={code.replace(/\n$/, '')} language="" />;
  },
};

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
        <Text style={[styles.messageText, { color: colors.userBubbleText }]} selectable>
          {segment.content}
        </Text>
      ) : (
        <Markdown style={mdStyles as any} rules={codeBlockRules}>{segment.content}</Markdown>
      );

    case 'toolCall':
      return (
        <TouchableOpacity
          style={[styles.toolContainer, { borderColor: colors.separator }]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={styles.toolHeader}>
            <Text style={[styles.toolIcon, { color: colors.textTertiary }]}>
              {segment.isComplete ? '🔧' : '⏳'}
            </Text>
            <View style={styles.toolHeaderInfo}>
              <Text style={[styles.toolName, { color: colors.textSecondary }]}>{segment.toolName}</Text>
              <Text style={[styles.toolStatus, { color: colors.textTertiary }]}>
                {segment.isComplete ? 'Completed' : 'Running…'}
              </Text>
            </View>
            {!segment.isComplete && <ActivityIndicator size="small" color={colors.primary} />}
            {segment.isComplete && <Text style={[styles.toolCheck, { color: colors.healthyGreen }]}>✓</Text>}
            <Text style={[styles.chevron, { color: colors.textTertiary }]}>
              {expanded ? '▾' : '▸'}
            </Text>
          </View>
          {expanded && (
            <View style={styles.toolDetails}>
              <Text style={[styles.toolLabel, { color: colors.textTertiary }]}>Input:</Text>
              <Text style={[styles.toolCode, { color: colors.codeText, backgroundColor: colors.codeBackground }]} selectable>
                {segment.input}
              </Text>
              {segment.result && (
                <>
                  <Text style={[styles.toolLabel, { color: colors.textTertiary }]}>Result:</Text>
                  <Text style={[styles.toolCode, { color: colors.codeText, backgroundColor: colors.codeBackground }]} selectable>
                    {segment.result.substring(0, 1000)}
                    {segment.result.length > 1000 ? '…' : ''}
                  </Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
      );

    case 'thought':
      return (
        <TouchableOpacity
          style={styles.thoughtContainer}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={[styles.thoughtHeader, { color: colors.textTertiary }]}>
            {expanded ? '▾ Thinking' : '▸ Thinking…'}
          </Text>
          {expanded && (
            <Text style={[styles.thoughtContent, { color: colors.textTertiary }]} selectable>
              {segment.content}
            </Text>
          )}
        </TouchableOpacity>
      );

    default:
      return null;
  }
});

const styles = StyleSheet.create({
  messageText: {
    fontSize: FontSize.body,
    lineHeight: 24,
  },
  toolContainer: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginVertical: 4,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolIcon: {
    fontSize: 16,
  },
  toolName: {
    fontWeight: '600',
    fontSize: FontSize.footnote,
    fontFamily: 'monospace',
  },
  toolHeaderInfo: {
    flex: 1,
  },
  toolStatus: {
    fontSize: 11,
  },
  toolCheck: {
    fontSize: 14,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: 4,
  },
  toolDetails: {
    marginTop: 8,
    gap: 4,
  },
  toolLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolCode: {
    fontFamily: 'monospace',
    fontSize: FontSize.caption,
    padding: Spacing.sm,
    borderRadius: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  thoughtContainer: {
    marginVertical: 4,
    padding: Spacing.sm,
  },
  thoughtHeader: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  thoughtContent: {
    fontSize: FontSize.footnote,
    lineHeight: 20,
    marginTop: 4,
  },
});
