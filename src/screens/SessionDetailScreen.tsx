/**
 * Session detail screen — ChatGPT-style chat view with centered empty state.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../stores/appStore';
import { ChatBubble } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';
import { TypingIndicator } from '../components/TypingIndicator';
import { ChatMessage, ACPConnectionState } from '../acp/models/types';
import { useTheme, FontSize, Spacing } from '../utils/theme';

export function SessionDetailScreen() {
  const { colors } = useTheme();
  const {
    chatMessages,
    promptText,
    isStreaming,
    connectionState,
    isInitialized,
    stopReason,
    selectedSessionId,
    sendPrompt,
    cancelPrompt,
    setPromptText,
  } = useAppStore();

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isConnected =
    connectionState === ACPConnectionState.Connected && isInitialized;

  // Smart auto-scroll: only scroll when user is near the bottom
  const isNearBottom = useRef(true);
  const prevMessageCount = useRef(chatMessages.length);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      isNearBottom.current = distanceFromBottom < 120;
    },
    [],
  );

  useEffect(() => {
    if (chatMessages.length > prevMessageCount.current && isNearBottom.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
    prevMessageCount.current = chatMessages.length;
  }, [chatMessages.length]);

  // Also scroll when streaming content updates (user at bottom)
  const lastContent = chatMessages[chatMessages.length - 1]?.content;
  useEffect(() => {
    if (isStreaming && isNearBottom.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [lastContent, isStreaming]);

  // Haptic on new response
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (!prevStreaming.current && isStreaming) {
      // Agent started responding
    }
    if (prevStreaming.current && !isStreaming && chatMessages.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, chatMessages.length]);

  const handleSend = useCallback(() => {
    const text = promptText.trim();
    if (!text) return;
    isNearBottom.current = true;
    sendPrompt(text);
  }, [promptText, sendPrompt]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatBubble message={item} />,
    [],
  );

  // Pulsing animation for empty state icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (chatMessages.length === 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [chatMessages.length, pulseAnim]);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Animated.View style={[styles.emptyIcon, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.emptyIconText}>✦</Text>
        </Animated.View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {isConnected ? 'How can I help you today?' : 'Not connected'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
          {isConnected
            ? 'Type a message to start a conversation'
            : 'Open the sidebar to connect to a server'}
        </Text>
      </View>
    ),
    [isConnected, colors, pulseAnim],
  );

  const showTyping = isStreaming && chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1]?.role === 'user';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={showTyping ? <TypingIndicator /> : null}
        contentContainerStyle={
          chatMessages.length === 0 ? styles.emptyList : styles.messageList
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {stopReason && !isStreaming && (
        <View style={styles.stopReasonContainer}>
          <Text style={[styles.stopReasonText, { color: colors.textTertiary }]}>
            {stopReason === 'end_turn'
              ? 'Agent finished'
              : `Stopped: ${stopReason}`}
          </Text>
        </View>
      )}

      <MessageComposer
        value={promptText}
        onChangeText={setPromptText}
        onSend={handleSend}
        onCancel={cancelPrompt}
        isStreaming={isStreaming}
        isDisabled={!isConnected}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    paddingVertical: Spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyIconText: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  emptyTitle: {
    fontSize: FontSize.title3,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  stopReasonContainer: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  stopReasonText: {
    fontSize: FontSize.caption,
    fontStyle: 'italic',
  },
});
