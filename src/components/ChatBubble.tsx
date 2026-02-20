/**
 * ChatBubble — ChatGPT-style full-width message block.
 * Sub-components extracted to src/components/chat/.
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
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
  onLongPress?: (message: ChatMessage) => void;
  onOpenArtifact?: (artifact: import('../acp/models/types').Artifact) => void;
}

const containerStyle = {
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
} as const;

const systemContainerStyle = {
  paddingVertical: Spacing.xs,
} as const;

export const ChatBubble = React.memo(function ChatBubble({ message, onSpeak, isSpeaking, onLongPress, onOpenArtifact }: Props) {
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
    <Pressable onLongPress={() => onLongPress?.(message)} delayLongPress={400}>
    <Animated.View
      style={[
        containerStyle,
        isUser ? ds.bgUserMessage : ds.bgAssistantMessage,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        isSystem && systemContainerStyle,
      ]}
    >
      <XStack alignItems="flex-start" maxWidth={768} alignSelf="center" width="100%">
        {/* Avatar */}
        {!isUser && !isSystem && (
          <YStack marginRight={Spacing.md} marginTop={2}>
            <YStack style={ds.avatar}>
              <Text style={ds.avatarIcon}>✦</Text>
            </YStack>
          </YStack>
        )}

        <YStack flex={1} {...(isUser && { paddingLeft: 40 })}>
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
                <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} onOpenArtifact={onOpenArtifact} />
              ) : null}
            </>
          ) : isUser ? (
            <Text fontSize={FontSize.body} lineHeight={24} color={colors.userBubbleText} selectable>
              {message.content}
            </Text>
          ) : isSystem ? (
            <Text fontSize={FontSize.footnote} fontStyle="italic" textAlign="center" style={ds.textTertiary} selectable>
              {message.content}
            </Text>
          ) : (
            <MarkdownContent content={message.content} colors={colors} artifacts={message.artifacts} onOpenArtifact={onOpenArtifact} />
          )}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <ActivityIndicator
              size="small"
              color={colors.textTertiary}
              style={{ marginTop: Spacing.xs, alignSelf: 'flex-start' }}
            />
          )}

          {/* TTS action bar */}
          {!isUser && !isSystem && !message.isStreaming && message.content && (
            <XStack gap={Spacing.sm} marginTop={Spacing.xs}>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => onSpeak?.(message.content)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text fontSize={16} color={isSpeaking ? colors.primary : colors.textTertiary}>
                  {isSpeaking ? '🔊' : '🔈'}
                </Text>
              </TouchableOpacity>
            </XStack>
          )}
        </YStack>
      </XStack>
    </Animated.View>
    </Pressable>
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
            paddingHorizontal={Spacing.sm}
            paddingVertical={Spacing.xs}
            gap={4}
            backgroundColor={colors.codeBackground}
          >
            <Text fontSize={16}>{getFileIcon(att.mediaType)}</Text>
            <Text fontSize={FontSize.caption} color={colors.text} maxWidth={150} numberOfLines={1}>{att.name}</Text>
          </XStack>
        );
      })}
      <ImageModal visible={!!previewUri} uri={previewUri ?? ''} onClose={() => setPreviewUri(null)} />
    </XStack>
  );
});
