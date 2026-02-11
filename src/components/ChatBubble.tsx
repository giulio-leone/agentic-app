/**
 * Chat message bubble component — themed, markdown-enabled, animated.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ChatMessage, MessageSegment } from '../acp/models/types';
import { useTheme, FontSize, Spacing, Radius, ThemeColors } from '../utils/theme';

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Fade-in + slide-up animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const mdStyles = markdownStyles(colors, isUser);

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        isSystem && styles.systemContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.userBubble }]
            : [styles.assistantBubble, { backgroundColor: colors.assistantBubble }],
          isSystem && styles.systemBubble,
        ]}
      >
        {message.segments && message.segments.length > 0 ? (
          message.segments.map((segment, index) => (
            <SegmentView key={index} segment={segment} colors={colors} isUser={isUser} mdStyles={mdStyles} />
          ))
        ) : isUser || isSystem ? (
          <Text
            style={[
              styles.messageText,
              { color: isUser ? colors.userBubbleText : colors.text },
              isSystem && { color: colors.systemGray, fontStyle: 'italic', fontSize: FontSize.footnote, textAlign: 'center' },
            ]}
            selectable
          >
            {message.content}
          </Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
        )}
        {message.isStreaming && (
          <ActivityIndicator
            size="small"
            color={isUser ? '#FFFFFF' : colors.primary}
            style={styles.streamingIndicator}
          />
        )}
      </View>
    </Animated.View>
  );
}

function SegmentView({
  segment,
  colors,
  isUser,
  mdStyles,
}: {
  segment: MessageSegment;
  colors: ThemeColors;
  isUser: boolean;
  mdStyles: any;
}) {
  const [expanded, setExpanded] = useState(false);

  switch (segment.type) {
    case 'text':
      return isUser ? (
        <Text style={[styles.messageText, { color: colors.userBubbleText }]} selectable>
          {segment.content}
        </Text>
      ) : (
        <Markdown style={mdStyles}>{segment.content}</Markdown>
      );

    case 'toolCall':
      return (
        <TouchableOpacity
          style={[styles.toolCallContainer, { backgroundColor: colors.toolCallBackground }]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={styles.toolCallHeader}>
            <Text style={styles.toolCallIcon}>⚙️</Text>
            <Text style={[styles.toolCallName, { color: colors.text }]}>{segment.toolName}</Text>
            {!segment.isComplete && (
              <ActivityIndicator size="small" color={colors.orange} />
            )}
            {segment.isComplete && (
              <Text style={{ color: colors.healthyGreen, fontWeight: 'bold' }}>✓</Text>
            )}
          </View>
          {expanded && (
            <View style={styles.toolCallDetails}>
              <Text style={[styles.toolCallLabel, { color: colors.textSecondary }]}>Input:</Text>
              <Text style={[styles.toolCallCode, { color: colors.codeText, backgroundColor: colors.codeBackground }]} selectable>
                {segment.input}
              </Text>
              {segment.result && (
                <>
                  <Text style={[styles.toolCallLabel, { color: colors.textSecondary }]}>Result:</Text>
                  <Text style={[styles.toolCallCode, { color: colors.codeText, backgroundColor: colors.codeBackground }]} selectable>
                    {segment.result.substring(0, 500)}
                    {segment.result.length > 500 ? '…' : ''}
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
          style={[styles.thoughtContainer, { backgroundColor: colors.thoughtBackground }]}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={[styles.thoughtHeader, { color: colors.textSecondary }]}>
            💭 {expanded ? 'Thinking' : 'Thinking…'}
          </Text>
          {expanded && (
            <Text style={[styles.thoughtContent, { color: colors.textSecondary }]} selectable>
              {segment.content}
            </Text>
          )}
        </TouchableOpacity>
      );

    default:
      return null;
  }
}

function markdownStyles(colors: ThemeColors, _isUser: boolean) {
  return {
    body: {
      color: colors.assistantBubbleText,
      fontSize: FontSize.body,
      lineHeight: 24,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 6,
    },
    heading1: {
      color: colors.text,
      fontSize: FontSize.title2,
      fontWeight: '700' as const,
      marginTop: 8,
      marginBottom: 4,
    },
    heading2: {
      color: colors.text,
      fontSize: FontSize.title3,
      fontWeight: '600' as const,
      marginTop: 6,
      marginBottom: 4,
    },
    heading3: {
      color: colors.text,
      fontSize: FontSize.headline,
      fontWeight: '600' as const,
      marginTop: 4,
      marginBottom: 2,
    },
    strong: {
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    code_inline: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.footnote,
      fontFamily: 'monospace',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.caption,
      fontFamily: 'monospace',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      marginVertical: 4,
      overflow: 'hidden' as const,
    },
    code_block: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.caption,
      fontFamily: 'monospace',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      marginVertical: 4,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
    list_item: {
      marginVertical: 2,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    blockquote: {
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      paddingLeft: Spacing.md,
      marginVertical: 4,
      opacity: 0.8,
    },
    hr: {
      backgroundColor: colors.separator,
      height: 1,
      marginVertical: 8,
    },
  };
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 3,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  systemContainer: {
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: Radius.lg + 2,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    borderBottomLeftRadius: 6,
  },
  systemBubble: {
    backgroundColor: 'transparent',
    maxWidth: '90%',
  },
  messageText: {
    fontSize: FontSize.body,
    lineHeight: 24,
  },
  streamingIndicator: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  toolCallContainer: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  toolCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toolCallIcon: {
    fontSize: 14,
  },
  toolCallName: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
    flex: 1,
  },
  toolCallDetails: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  toolCallLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  toolCallCode: {
    fontSize: FontSize.caption,
    fontFamily: 'monospace',
    borderRadius: 4,
    padding: Spacing.xs,
    overflow: 'hidden',
  },
  thoughtContainer: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  thoughtHeader: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  thoughtContent: {
    fontSize: FontSize.footnote,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});
