/**
 * Session detail screen — ChatGPT-style chat view with centered empty state.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from 'react-native';
import { YStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../stores/appStore';
import { ChatBubble } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';
import { ModelPickerBar } from '../components/ModelPickerBar';
import { TypingIndicator } from '../components/TypingIndicator';
import { ChatMessage, ACPConnectionState, Attachment, ServerType } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing } from '../utils/theme';
import { useSpeech } from '../hooks/useSpeech';
import { useVoiceInput } from '../hooks/useVoiceInput';

// Stable key extractor avoids re-creating function per render
const keyExtractor = (item: ChatMessage) => item.id;

const emptyListStyle = { flex: 1, justifyContent: 'center', alignItems: 'center' } as const;
const messageListStyle = { paddingVertical: Spacing.sm } as const;

const emptyIconBaseStyle = {
  width: 48, height: 48, borderRadius: 24,
  justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
} as const;

export function SessionDetailScreen() {
  const { colors } = useDesignSystem();
  const {
    chatMessages,
    promptText,
    isStreaming,
    connectionState,
    isInitialized,
    stopReason,
    selectedSessionId,
    selectedServerId,
    servers,
    sendPrompt,
    cancelPrompt,
    setPromptText,
  } = useAppStore();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isAIProvider = selectedServer?.serverType === ServerType.AIProvider;
  const isConnected = isAIProvider || (connectionState === ACPConnectionState.Connected && isInitialized);

  // TTS — extract speaking state into ref to avoid re-rendering all messages
  const { toggle: toggleSpeech, isSpeaking, stop: stopSpeech } = useSpeech();
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const speakingRef = useRef({ isSpeaking, speakingMessageId });
  speakingRef.current = { isSpeaking, speakingMessageId };

  const handleSpeak = useCallback((text: string, messageId?: string) => {
    const { isSpeaking: speaking, speakingMessageId: speakId } = speakingRef.current;
    if (speakId === messageId && speaking) {
      stopSpeech();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(messageId || null);
      toggleSpeech(text);
    }
  }, [toggleSpeech, stopSpeech]);

  // STT
  const onTranscript = useCallback((text: string) => setPromptText(text), [setPromptText]);
  const { isListening, toggle: toggleVoice, isAvailable: voiceAvailable } = useVoiceInput({
    onTranscript,
    onFinalTranscript: onTranscript,
  });

  // Smart auto-scroll: only scroll when user is near the bottom
  const isNearBottom = useRef(true);
  const prevMessageCount = useRef(chatMessages.length);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      isNearBottom.current =
        contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
    },
    [],
  );

  useEffect(() => {
    if (chatMessages.length > prevMessageCount.current && isNearBottom.current) {
      scrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
    prevMessageCount.current = chatMessages.length;
    return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, [chatMessages.length]);

  // Scroll during streaming — use ref to avoid cleanup on every content change
  const streamScrollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContent = chatMessages[chatMessages.length - 1]?.content;
  useEffect(() => {
    if (isStreaming && isNearBottom.current) {
      streamScrollRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
    return () => { if (streamScrollRef.current) clearTimeout(streamScrollRef.current); };
  }, [lastContent, isStreaming]);

  // Haptic on response complete
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && chatMessages.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, chatMessages.length]);

  const handleSend = useCallback((attachments?: Attachment[]) => {
    const text = promptText.trim();
    if (!text && (!attachments || attachments.length === 0)) return;
    isNearBottom.current = true;
    sendPrompt(text, attachments);
  }, [promptText, sendPrompt]);

  // Render message — pass only handleSpeak callback; ChatBubble reads speaking state itself
  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble
        message={item}
        onSpeak={(text) => handleSpeak(text, item.id)}
        isSpeaking={speakingRef.current.isSpeaking && speakingRef.current.speakingMessageId === item.id}
      />
    ),
    [handleSpeak],
  );

  // Pulsing animation for empty state — properly managed with start/stop
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (chatMessages.length === 0) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      );
      pulseRef.current = anim;
      anim.start();
    } else if (pulseRef.current) {
      pulseRef.current.stop();
      pulseAnim.setValue(1);
      pulseRef.current = null;
    }
  }, [chatMessages.length, pulseAnim]);

  // Memoize empty state inline styles
  const emptyIconStyle = useMemo(
    () => [emptyIconBaseStyle, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }],
    [colors.primary, pulseAnim],
  );

  const renderEmpty = useCallback(
    () => (
      <YStack alignItems="center" gap={Spacing.md} paddingHorizontal={Spacing.xxl}>
        <Animated.View style={emptyIconStyle}>
          <Text fontSize={22} color={colors.contrastText}>✦</Text>
        </Animated.View>
        <Text fontSize={FontSize.title3} fontWeight="600" color={colors.text}>
          {isConnected ? 'How can I help you today?' : 'Not connected'}
        </Text>
        <Text fontSize={FontSize.body} textAlign="center" lineHeight={22} color={colors.textTertiary}>
          {isConnected
            ? 'Type a message to start a conversation'
            : 'Open the sidebar to connect to a server'}
        </Text>
      </YStack>
    ),
    [isConnected, emptyIconStyle, colors.contrastText, colors.text, colors.textTertiary],
  );

  const showTyping = isStreaming && chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1]?.role === 'user';

  const containerStyle = useMemo(
    () => ({ flex: 1, backgroundColor: colors.background } as const),
    [colors.background],
  );

  return (
    <KeyboardAvoidingView
      style={containerStyle}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={keyExtractor}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={showTyping ? <TypingIndicator /> : null}
        contentContainerStyle={
          chatMessages.length === 0 ? emptyListStyle : messageListStyle
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
      />

      {stopReason && !isStreaming && (
        <YStack paddingVertical={Spacing.xs} paddingHorizontal={Spacing.md} alignItems="center">
          <Text fontSize={FontSize.caption} fontStyle="italic" color={colors.textTertiary}>
            {stopReason === 'end_turn'
              ? 'Response complete'
              : stopReason === 'max_tokens'
              ? 'Reached token limit'
              : stopReason === 'cancelled'
              ? 'Cancelled'
              : `Stopped: ${stopReason}`}
          </Text>
        </YStack>
      )}

      {/* Model picker for AI providers */}
      {isAIProvider && selectedServer && (
        <ModelPickerBar server={selectedServer} />
      )}

      <MessageComposer
        value={promptText}
        onChangeText={setPromptText}
        onSend={handleSend}
        onCancel={cancelPrompt}
        isStreaming={isStreaming}
        isDisabled={!isConnected}
        isListening={isListening}
        onToggleVoice={voiceAvailable ? toggleVoice : undefined}
      />
    </KeyboardAvoidingView>
  );
}
