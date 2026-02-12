/**
 * ChatBubble — ChatGPT-style full-width message block.
 * Sub-components extracted to src/components/chat/.
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { ChatMessage, Attachment } from '../acp/models/types';
import { useDesignSystem, layout } from '../utils/designSystem';
import { FontSize, Spacing, Radius, type ThemeColors } from '../utils/theme';
import { getFileIcon } from '../utils/fileUtils';
import { MarkdownContent, createMarkdownStyles } from './chat/MarkdownContent';
import { ReasoningView } from './chat/ReasoningView';
import { SegmentView } from './chat/SegmentView';
import { ImageModal } from './chat/ImageModal';

interface Props {
  message: ChatMessage;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

export const ChatBubble = React.memo(function ChatBubble({ message, onSpeak, isSpeaking }: Props) {
  const { ds, colors } = useDesignSystem();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const mdStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

  // Entrance animation (runs once)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const animRan = useRef(false);

  useEffect(() => {
    if (animRan.current) return;
    animRan.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? ds.bgUserMessage : ds.bgAssistantMessage,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        isSystem && styles.systemContainer,
      ]}
    >
      <View style={styles.messageRow}>
        {/* Avatar */}
        {!isUser && !isSystem && (
          <View style={styles.avatarContainer}>
            <View style={ds.avatar}>
              <Text style={ds.avatarIcon}>✦</Text>
            </View>
          </View>
        )}

        <View style={[layout.flex1, isUser && styles.userContent]}>
          {/* Attachments */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <AttachmentPreview attachments={message.attachments} colors={colors} />
          )}

          {/* Reasoning */}
          {!isUser && !isSystem && message.reasoning && (
            <ReasoningView
              reasoning={message.reasoning}
              colors={colors}
              isStreaming={!!message.isStreaming && !message.content}
            />
          )}

          {/* Segments (tool calls + text) */}
          {message.segments && message.segments.length > 0 ? (
            <>
              {message.segments.map((seg, i) => (
                <SegmentView key={i} segment={seg} colors={colors} isUser={isUser} mdStyles={mdStyles} />
              ))}
              {message.content ? (
                <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} />
              ) : null}
            </>
          ) : isUser ? (
            <Text style={[styles.messageText, { color: colors.userBubbleText }]} selectable>
              {message.content}
            </Text>
          ) : isSystem ? (
            <Text style={[styles.systemText, ds.textTertiary]} selectable>
              {message.content}
            </Text>
          ) : (
            <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} />
          )}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <ActivityIndicator size="small" color={colors.textTertiary} style={styles.streamingIndicator} />
          )}

          {/* TTS action bar */}
          {!isUser && !isSystem && !message.isStreaming && message.content && (
            <View style={[layout.row, layout.gapSm, { marginTop: Spacing.xs }]}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onSpeak?.(message.content)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.actionIcon, { color: isSpeaking ? colors.primary : colors.textTertiary }]}>
                  {isSpeaking ? '🔊' : '🔈'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

// ── Attachment preview ───────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;

const AttachmentPreview = React.memo(function AttachmentPreview({
  attachments,
  colors,
}: {
  attachments: Attachment[];
  colors: ThemeColors;
}) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  return (
    <View style={styles.attachments}>
      {attachments.map(att => {
        if (att.mediaType.startsWith('image/')) {
          return (
            <TouchableOpacity key={att.id} onPress={() => setPreviewUri(att.uri)} activeOpacity={0.8}>
              <Image source={{ uri: att.uri }} style={styles.inlineImage} resizeMode="cover" />
            </TouchableOpacity>
          );
        }
        return (
          <View key={att.id} style={[styles.fileChip, { backgroundColor: colors.codeBackground }]}>
            <Text style={styles.fileChipIcon}>{getFileIcon(att.mediaType)}</Text>
            <Text style={[styles.fileChipName, { color: colors.text }]} numberOfLines={1}>{att.name}</Text>
          </View>
        );
      })}
      <ImageModal visible={!!previewUri} uri={previewUri ?? ''} onClose={() => setPreviewUri(null)} />
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  systemContainer: {
    paddingVertical: Spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
  },
  avatarContainer: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  userContent: {
    paddingLeft: 40,
  },
  messageText: {
    fontSize: FontSize.body,
    lineHeight: 24,
  },
  systemText: {
    fontSize: FontSize.footnote,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  streamingIndicator: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  actionButton: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 16,
  },
  attachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  inlineImage: {
    width: Math.min(SCREEN_W * 0.5, 240),
    height: Math.min(SCREEN_W * 0.5, 240),
    borderRadius: Radius.md,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  fileChipIcon: {
    fontSize: 16,
  },
  fileChipName: {
    fontSize: FontSize.caption,
    maxWidth: 150,
  },
});
