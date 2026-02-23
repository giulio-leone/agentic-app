/**
 * Hook for smart auto-scroll, FAB visibility, and unread count tracking.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from 'react-native';
import { ChatMessage } from '../../acp/models/types';

interface UseScrollToBottomOptions {
  chatMessages: ChatMessage[];
  isStreaming: boolean;
}

export function useScrollToBottom({ chatMessages, isStreaming }: UseScrollToBottomOptions) {
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottom = useRef(true);
  const prevMessageCount = useRef(chatMessages.length);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showFab, setShowFab] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fabOpacity = useRef(new Animated.Value(0)).current;

  const showFabRef = useRef(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const nearBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
      isNearBottom.current = nearBottom;
      if (nearBottom) {
        showFabRef.current = false;
        setShowFab(false);
        setUnreadCount(0);
        Animated.timing(fabOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      } else if (!showFabRef.current && chatMessages.length > 0) {
        showFabRef.current = true;
        setShowFab(true);
        Animated.timing(fabOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    },
    [chatMessages.length, fabOpacity],
  );

  // Auto-scroll on new messages when near bottom
  useEffect(() => {
    if (chatMessages.length > prevMessageCount.current) {
      if (isNearBottom.current) {
        scrollTimerRef.current = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } else {
        setUnreadCount(c => c + (chatMessages.length - prevMessageCount.current));
      }
    }
    prevMessageCount.current = chatMessages.length;
    return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, [chatMessages.length]);

  // Scroll during streaming
  const streamScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isStreaming || !isNearBottom.current) {
      if (streamScrollRef.current) { clearInterval(streamScrollRef.current); streamScrollRef.current = null; }
      return;
    }
    streamScrollRef.current = setInterval(() => {
      if (isNearBottom.current) {
        flatListRef.current?.scrollToEnd({ animated: false });
      }
    }, 100);
    return () => { if (streamScrollRef.current) { clearInterval(streamScrollRef.current); streamScrollRef.current = null; } };
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    isNearBottom.current = true;
    showFabRef.current = false;
    setShowFab(false);
    setUnreadCount(0);
    Animated.timing(fabOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  }, [fabOpacity]);

  /** Mark as near-bottom (e.g. before sending a message) */
  const markNearBottom = useCallback(() => {
    isNearBottom.current = true;
  }, []);

  return {
    flatListRef,
    showFab,
    unreadCount,
    fabOpacity,
    handleScroll,
    scrollToBottom,
    markNearBottom,
  };
}
