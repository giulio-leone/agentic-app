/**
 * ChatBubble — ChatGPT-style full-width message block.
 * Sub-components extracted to src/components/chat/.
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  TouchableOpacity,
  Animated as RNAnimated,
  Image,
  Dimensions,
  Pressable,
  Platform,
  View,
  Text as RNText,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { YStack, XStack, Text } from 'tamagui';
import { Sparkles, Volume1, Volume2, Bookmark } from 'lucide-react-native';
import { ChatMessage, Attachment } from '../acp/models/types';
import { useDesignSystem, layout } from '../utils/designSystem';
import { FontSize, Spacing, Radius, type ThemeColors } from '../utils/theme';
import { getFileIcon, formatSize } from '../utils/fileUtils';
import { getServerColor } from '../utils/serverColors';
import { MarkdownContent, createMarkdownStyles } from './chat/MarkdownContent';
import { ReasoningView } from './chat/ReasoningView';
import { ConsensusDetailView } from './chat/ConsensusDetailView';
import { SegmentView } from './chat/SegmentView';
import { ImageModal } from './chat/ImageModal';

interface Props {
  message: ChatMessage;
  onSpeak?: (text: string, messageId: string) => void;
  isSpeaking?: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onOpenArtifact?: (artifact: import('../acp/models/types').Artifact) => void;
  highlighted?: boolean;
  bookmarked?: boolean;
}

const containerStyle = {
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.sm,
  flexDirection: 'row',
  width: '100%',
} as const;

const bubbleStyle = {
  flexDirection: 'row' as const,
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.md,
  borderRadius: Radius.xl,
  maxWidth: '85%',
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
  }),
} as const;

const systemContainerStyle = {
  paddingVertical: Spacing.xs,
  alignSelf: 'center',
} as const;

export const ChatBubble = React.memo(function ChatBubble({ message, onSpeak, isSpeaking, onLongPress, onOpenArtifact, highlighted, bookmarked }: Props) {
  const { ds, colors } = useDesignSystem();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const mdStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

  return (
    <Pressable
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={400}
      accessibilityRole="text"
      accessibilityLabel={`${isUser ? 'You' : message.serverName || 'Assistant'}: ${message.content.slice(0, 100)}`}
    >
      <Animated.View
        entering={FadeInDown.duration(250).springify().damping(18)}
        style={[
          containerStyle,
          {
            justifyContent: isSystem ? 'center' : isUser ? 'flex-end' : 'flex-start',
            backgroundColor: highlighted ? colors.primaryMuted : undefined,
          }
        ]}
      >
        <View
          style={[
            bubbleStyle,
            isUser ? ds.bgUserMessage : ds.bgAssistantMessage,
            isSystem && { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
          ]}
        >
          {/* Avatar */}
          {!isUser && !isSystem && (
            <YStack marginRight={Spacing.sm} marginTop={Spacing.xs}>
              <YStack style={[ds.avatar, message.serverId && { backgroundColor: getServerColor(message.serverId) }]}>
                <Sparkles size={16} color={colors.contrastText} />
              </YStack>
            </YStack>
          )}

          <View style={{ flexShrink: 1 }}>
            {/* Server name badge for multi-agent */}
            {!isUser && !isSystem && message.serverName && (
              <Text
                fontSize={FontSize.caption}
                fontWeight="600"
                color={message.serverId ? getServerColor(message.serverId) : colors.textTertiary}
                marginBottom={2}
              >
                {message.serverName}
              </Text>
            )}
            {/* Attachments */}
            {isUser && message.attachments && message.attachments.length > 0 && (
              <AttachmentPreview attachments={message.attachments} colors={colors} />
            )}

            {/* Reasoning */}
            {!isUser && !isSystem && message.reasoning && !message.consensusDetails && (
              <ReasoningView
                reasoning={message.reasoning}
                colors={colors}
                isStreaming={!!message.isStreaming && !message.content}
              />
            )}

            {/* Consensus Details (replaces reasoning for consensus messages) */}
            {!isUser && !isSystem && message.consensusDetails && (
              <ConsensusDetailView
                details={message.consensusDetails}
                colors={colors}
                isStreaming={!!message.isStreaming}
              />
            )}

            {/* Segments (tool calls + text) */}
            {message.segments && message.segments.length > 0 ? (
              <>
                {message.segments.map((seg, i) => (
                  <SegmentView key={i} segment={seg} colors={colors} isUser={isUser} mdStyles={mdStyles} />
                ))}
                {message.content ? (
                  <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} onOpenArtifact={onOpenArtifact} />
                ) : null}
              </>
            ) : isUser ? (
              <RNText style={{ fontSize: FontSize.body, lineHeight: 24, color: colors.userBubbleText }} selectable>
                {message.content || ''}
              </RNText>
            ) : isSystem ? (
              <RNText style={{ fontSize: FontSize.footnote, fontStyle: 'italic', textAlign: 'center', color: colors.textTertiary }} selectable>
                {message.content}
              </RNText>
            ) : (
              <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} onOpenArtifact={onOpenArtifact} />
            )}

            {/* Streaming cursor */}
            {message.isStreaming && (
              <StreamingCursor color={colors.primary} />
            )}

            {/* TTS action bar */}
            {!isUser && !isSystem && !message.isStreaming && message.content && (
              <XStack gap={Spacing.sm} marginTop={Spacing.xs} alignItems="center">
                <TouchableOpacity
                  style={{ padding: 4 }}
                  onPress={() => onSpeak?.(message.content, message.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize={16} color={isSpeaking ? colors.primary : colors.textTertiary}>
                    {isSpeaking ? <Volume2 size={16} color={colors.primary} /> : <Volume1 size={16} color={colors.textTertiary} />}
                  </Text>
                </TouchableOpacity>
                {bookmarked && (
                  <Bookmark size={14} color={colors.primary} fill={colors.primary} />
                )}
                <MessageTimestamp timestamp={message.timestamp} colors={colors} />
              </XStack>
            )}

            {/* Timestamp for user messages */}
            {isUser && !message.isStreaming && (
              <XStack justifyContent="flex-end" marginTop={Spacing.xs}>
                <MessageTimestamp timestamp={message.timestamp} colors={colors} />
              </XStack>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Custom deep equality to prevent 60fps re-renders of the entire list during streaming
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.message.attachments?.length === nextProps.message.attachments?.length &&
    prevProps.message.segments?.length === nextProps.message.segments?.length &&
    prevProps.highlighted === nextProps.highlighted &&
    prevProps.bookmarked === nextProps.bookmarked &&
    prevProps.message.serverId === nextProps.message.serverId &&
    prevProps.message.serverName === nextProps.message.serverName
  );
});

// ── Attachment preview ───────────────────────────────────────────────────────

// ── Streaming cursor — blinking inline caret ─────────────────────────────────

const StreamingCursor = React.memo(function StreamingCursor({ color }: { color: string }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const blink = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return (
    <RNAnimated.View
      style={{
        width: 2,
        height: 18,
        backgroundColor: color,
        borderRadius: 1,
        marginTop: Spacing.xs,
        opacity,
      }}
    />
  );
});

// ── Attachment preview ───────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const IMAGE_SIZE = Math.min(SCREEN_W * 0.5, 240);

const AttachmentPreview = React.memo(function AttachmentPreview({
  attachments,
  colors,
}: {
  attachments: Attachment[];
  colors: ThemeColors;
}) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  return (
    <XStack flexWrap="wrap" gap={Spacing.xs} marginBottom={Spacing.sm}>
      {attachments.map(att => {
        if (att.mediaType.startsWith('image/')) {
          return (
            <TouchableOpacity key={att.id} onPress={() => setPreviewUri(att.uri)} activeOpacity={0.8}>
              <Image
                source={{ uri: att.uri }}
                style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: Radius.md }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }
        return (
          <XStack
            key={att.id}
            alignItems="center"
            borderRadius={Radius.sm}
            paddingHorizontal={Spacing.md}
            paddingVertical={Spacing.sm}
            gap={Spacing.sm}
            backgroundColor={colors.codeBackground}
            minWidth={160}
          >
            {React.createElement(getFileIcon(att.mediaType), { size: 20, color: colors.primary })}
            <YStack flex={1}>
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.text} numberOfLines={1}>{att.name}</Text>
              {att.size ? (
                <Text fontSize={FontSize.caption - 1} color={colors.textTertiary}>{formatSize(att.size)}</Text>
              ) : null}
            </YStack>
          </XStack>
        );
      })}
      <ImageModal visible={!!previewUri} uri={previewUri ?? ''} onClose={() => setPreviewUri(null)} />
    </XStack>
  );
});

// ── Message timestamp ────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  } catch { return ''; }
}

const MessageTimestamp = React.memo(function MessageTimestamp({
  timestamp,
  colors,
}: {
  timestamp: string;
  colors: ThemeColors;
}) {
  const text = useMemo(() => formatTimestamp(timestamp), [timestamp]);
  if (!text) return null;
  return (
    <Text fontSize={10} color={colors.textTertiary} letterSpacing={0.2}>
      {text}
    </Text>
  );
});
