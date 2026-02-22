/**
 * ChatBubble — ChatGPT-style full-width message block.
 * Sub-components extracted to src/components/chat/.
 */

import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Pressable,
  Platform,
  View,
  Text as RNText,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { YStack, XStack, Text } from 'tamagui';
import { Sparkles, Volume1, Volume2, Bookmark } from 'lucide-react-native';
import { ChatMessage } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { getServerColor } from '../utils/serverColors';
import { MarkdownContent, createMarkdownStyles } from './chat/MarkdownContent';
import { ReasoningView } from './chat/ReasoningView';
import { ConsensusDetailView } from './chat/ConsensusDetailView';
import { SegmentView } from './chat/SegmentView';
import { BubbleAttachmentPreview } from './chat/BubbleAttachmentPreview';
import { StreamingCursor } from './chat/StreamingCursor';
import { MessageTimestamp } from './chat/MessageTimestamp';

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
              <BubbleAttachmentPreview attachments={message.attachments} colors={colors} />
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
                  accessibilityLabel={isSpeaking ? 'Stop reading aloud' : 'Read aloud'}
                  accessibilityRole="button"
                >
                  <Text fontSize={16} color={isSpeaking ? colors.primary : colors.textTertiary}>
                    {isSpeaking ? <Volume2 size={16} color={colors.primary} /> : <Volume1 size={16} color={colors.textTertiary} />}
                  </Text>
                </TouchableOpacity>
                {bookmarked && (
                  <Bookmark size={14} color={colors.primary} fill={colors.primary} accessibilityLabel="Bookmarked" />
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
