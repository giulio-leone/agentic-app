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
  TextInput,
  StyleSheet,
  RefreshControl,
  View,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { MessageSquare, Code, Lightbulb, Zap, PenLine } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAppStore } from '../stores/appStore';
import { ChatBubble } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';
import { ModelPickerBar } from '../components/ModelPickerBar';
import { TypingIndicator } from '../components/TypingIndicator';
import { MessageActionMenu } from '../components/chat/MessageActionMenu';
import { ScrollToBottomFab } from '../components/chat/ScrollToBottomFab';
import { SwipeableMessage } from '../components/chat/SwipeableMessage';
import { ChatSearchBar } from '../components/chat/ChatSearchBar';
import { ServerChipSelector } from '../components/chat/ServerChipSelector';
import { CanvasPanel } from '../components/canvas/CanvasPanel';
import { TemplatePickerSheet } from '../components/chat/TemplatePickerSheet';
import { SlashCommandAutocomplete } from '../components/chat/SlashCommandAutocomplete';
import { ChatMessage, ACPConnectionState, Attachment, Artifact, ServerType } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { useSpeech } from '../hooks/useSpeech';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { chatToMarkdown, chatToJSON, shareExport } from '../utils/chatExport';
import { BUILT_IN_TEMPLATES, matchTemplates, type PromptTemplate } from '../utils/promptTemplates';

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
    editMessage,
    deleteMessage,
    regenerateMessage,
    connect,
    loadSessionMessages,
    chatSearchVisible,
    toggleChatSearch,
    selectServer,
    toggleBookmark,
    bookmarkedMessageIds,
    loadBookmarks,
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

  // Load bookmarks on mount
  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  // Smart auto-scroll: only scroll when user is near the bottom
  const isNearBottom = useRef(true);
  const prevMessageCount = useRef(chatMessages.length);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FAB state: visible when scrolled up, tracks unread messages
  const [showFab, setShowFab] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fabOpacity = useRef(new Animated.Value(0)).current;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const nearBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
      isNearBottom.current = nearBottom;
      if (nearBottom) {
        setShowFab(false);
        setUnreadCount(0);
        Animated.timing(fabOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      } else if (!showFab && chatMessages.length > 0) {
        setShowFab(true);
        Animated.timing(fabOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    },
    [showFab, chatMessages.length, fabOpacity],
  );

  useEffect(() => {
    if (chatMessages.length > prevMessageCount.current) {
      if (isNearBottom.current) {
        scrollTimerRef.current = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } else {
        // User is scrolled up — track unread messages
        setUnreadCount(c => c + (chatMessages.length - prevMessageCount.current));
      }
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

  // ── Quote / Reply state ──
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);

  const handleSwipeReply = useCallback((message: ChatMessage) => {
    setQuotedMessage(message);
  }, []);

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return chatMessages
      .map((m, i) => (m.content.toLowerCase().includes(q) ? i : -1))
      .filter(i => i !== -1);
  }, [chatMessages, searchQuery]);

  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

  const handleSearchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(next);
    flatListRef.current?.scrollToIndex({ index: searchMatches[next]!, animated: true, viewPosition: 0.5 });
  }, [searchMatches, currentMatchIdx]);

  const handleSearchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prev);
    flatListRef.current?.scrollToIndex({ index: searchMatches[prev]!, animated: true, viewPosition: 0.5 });
  }, [searchMatches, currentMatchIdx]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIdx(0);
    if (searchMatches.length > 0) {
      flatListRef.current?.scrollToIndex({ index: searchMatches[0]!, animated: true, viewPosition: 0.5 });
    }
  }, [searchQuery]);

  // Clamp match index when matches shrink (e.g. messages added/removed during search)
  useEffect(() => {
    if (searchMatches.length > 0 && currentMatchIdx >= searchMatches.length) {
      setCurrentMatchIdx(searchMatches.length - 1);
    }
  }, [searchMatches.length, currentMatchIdx]);

  // ── Template state ──
  const [templateSheetVisible, setTemplateSheetVisible] = useState(false);

  const slashMatches = useMemo(() =>
    matchTemplates(promptText, BUILT_IN_TEMPLATES),
    [promptText],
  );

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setPromptText(template.prompt);
    setTemplateSheetVisible(false);
  }, [setPromptText]);

  const handleSend = useCallback((attachments?: Attachment[]) => {
    const text = promptText.trim();
    if (!text && (!attachments || attachments.length === 0)) return;
    isNearBottom.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Prepend quote context if replying to a message
    const prefix = quotedMessage
      ? `> ${quotedMessage.content.slice(0, 200).replace(/\n/g, '\n> ')}\n\n`
      : '';
    sendPrompt(prefix + text, attachments);
    setQuotedMessage(null);
  }, [promptText, sendPrompt, quotedMessage]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    isNearBottom.current = true;
    setShowFab(false);
    setUnreadCount(0);
    Animated.timing(fabOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  }, [fabOpacity]);

  // ── Pull-to-refresh: reconnect ACP or reload messages ──
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (!isAIProvider && connectionState !== ACPConnectionState.Connected) {
        connect();
      } else if (selectedSessionId) {
        await loadSessionMessages(selectedSessionId);
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  }, [isAIProvider, connectionState, connect, loadSessionMessages, selectedSessionId]);

  // ── Message CRUD state ──
  const [actionMenuMessage, setActionMenuMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // ── Canvas state ──
  const [canvasArtifact, setCanvasArtifact] = useState<Artifact | null>(null);

  const handleOpenArtifact = useCallback((artifact: Artifact) => {
    setCanvasArtifact(artifact);
  }, []);

  const handleLongPress = useCallback((message: ChatMessage) => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMenuMessage(message);
  }, [isStreaming]);

  const handleCopy = useCallback(() => {
    if (actionMenuMessage) {
      Clipboard.setStringAsync(actionMenuMessage.content);
    }
  }, [actionMenuMessage]);

  const handleDelete = useCallback(() => {
    if (actionMenuMessage) {
      deleteMessage(actionMenuMessage.id);
    }
  }, [actionMenuMessage, deleteMessage]);

  const handleRegenerate = useCallback(() => {
    if (actionMenuMessage) {
      regenerateMessage(actionMenuMessage.id);
    }
  }, [actionMenuMessage, regenerateMessage]);

  const handleBookmark = useCallback(() => {
    if (actionMenuMessage) {
      toggleBookmark(actionMenuMessage.id);
    }
  }, [actionMenuMessage, toggleBookmark]);

  const handleExportChat = useCallback(() => {
    if (chatMessages.length === 0) return;
    const title = `Chat ${new Date().toISOString().slice(0, 10)}`;
    // Show format picker via Alert
    import('react-native').then(({ Alert }) => {
      Alert.alert('Export Format', 'Choose export format', [
        {
          text: 'Markdown',
          onPress: () => {
            const md = chatToMarkdown(chatMessages, title);
            shareExport(md, `${title}.md`);
          },
        },
        {
          text: 'JSON',
          onPress: () => {
            const json = chatToJSON(chatMessages, title);
            shareExport(json, `${title}.json`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    });
  }, [chatMessages]);

  const handleEditStart = useCallback(() => {
    if (actionMenuMessage) {
      setEditingMessageId(actionMenuMessage.id);
      setEditText(actionMenuMessage.content);
    }
  }, [actionMenuMessage]);

  const handleEditSubmit = useCallback(() => {
    if (editingMessageId && editText.trim()) {
      editMessage(editingMessageId, editText.trim());
    }
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, editMessage]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  // Render message — pass stable handleSpeak and handleLongPress callbacks
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // Inline edit mode for user or assistant messages
      if (editingMessageId === item.id) {
        const isUserEdit = item.role === 'user';
        return (
          <YStack
            paddingHorizontal={Spacing.lg}
            paddingVertical={Spacing.md}
            backgroundColor={isUserEdit ? colors.userBubble : colors.surface}
          >
            <XStack maxWidth={768} alignSelf="center" width="100%" gap={Spacing.sm}>
              <YStack flex={1} paddingLeft={isUserEdit ? 40 : 0}>
                <TextInput
                  style={[
                    inlineEditStyles.input,
                    {
                      color: colors.text,
                      borderColor: colors.primary,
                      backgroundColor: colors.inputBackground,
                      minHeight: isUserEdit ? 40 : 100,
                    },
                  ]}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  autoFocus
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleEditSubmit}
                />
                <XStack gap={Spacing.sm} marginTop={Spacing.sm} justifyContent="flex-end">
                  <Text
                    fontSize={FontSize.footnote}
                    color={colors.textTertiary}
                    onPress={handleEditCancel}
                    paddingHorizontal={Spacing.sm}
                    paddingVertical={Spacing.xs}
                  >
                    Cancel
                  </Text>
                  <Text
                    fontSize={FontSize.footnote}
                    fontWeight="600"
                    color={colors.primary}
                    onPress={handleEditSubmit}
                    paddingHorizontal={Spacing.sm}
                    paddingVertical={Spacing.xs}
                  >
                    {isUserEdit ? 'Send' : 'Save'}
                  </Text>
                </XStack>
              </YStack>
            </XStack>
          </YStack>
        );
      }

      return (
        <SwipeableMessage
          onSwipeReply={() => handleSwipeReply(item)}
          colors={colors}
          enabled={!isStreaming && item.role !== 'system'}
        >
          <ChatBubble
            message={item}
            onSpeak={handleSpeak}
            isSpeaking={speakingRef.current.isSpeaking && speakingRef.current.speakingMessageId === item.id}
            onLongPress={handleLongPress}
            onOpenArtifact={handleOpenArtifact}
            highlighted={searchMatchSet.has(index)}
            bookmarked={bookmarkedMessageIds.has(item.id)}
          />
        </SwipeableMessage>
      );
    },
    [handleSpeak, handleLongPress, handleSwipeReply, isStreaming, editingMessageId, editText, colors, handleEditSubmit, handleEditCancel, handleOpenArtifact, searchMatchSet, bookmarkedMessageIds],
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

  const SUGGESTION_CHIPS = useMemo(() => [
    { icon: MessageSquare, text: 'Explain this code', prompt: 'Explain this code to me step by step' },
    { icon: Code, text: 'Write a function', prompt: 'Write a function that ' },
    { icon: Lightbulb, text: 'Help me brainstorm', prompt: 'Help me brainstorm ideas for ' },
    { icon: Zap, text: 'Debug an error', prompt: 'I have this error: ' },
  ], []);

  const handleSuggestion = useCallback((prompt: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromptText(prompt);
  }, [setPromptText]);

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
        {isConnected && (
          <YStack gap={Spacing.xs} marginTop={Spacing.md} width="100%" maxWidth={320}>
            {SUGGESTION_CHIPS.map((chip) => (
              <Pressable
                key={chip.text}
                onPress={() => handleSuggestion(chip.prompt)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.sm,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.separator,
                  backgroundColor: colors.cardBackground,
                })}
                accessibilityLabel={chip.text}
                accessibilityRole="button"
              >
                <chip.icon size={16} color={colors.primary} />
                <Text fontSize={FontSize.footnote} color={colors.text}>{chip.text}</Text>
              </Pressable>
            ))}
          </YStack>
        )}
      </YStack>
    ),
    [isConnected, emptyIconStyle, colors, SUGGESTION_CHIPS, handleSuggestion],
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
      <ChatSearchBar
        visible={chatSearchVisible}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onClose={() => { toggleChatSearch(); setSearchQuery(''); }}
        matchCount={searchMatches.length}
        currentMatch={currentMatchIdx}
        onPrev={handleSearchPrev}
        onNext={handleSearchNext}
        colors={colors}
      />
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={keyExtractor}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={showTyping ? <TypingIndicator /> : null}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
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
        removeClippedSubviews={false}
        initialNumToRender={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      <ScrollToBottomFab
        visible={showFab}
        unreadCount={unreadCount}
        onPress={scrollToBottom}
        colors={colors}
        opacity={fabOpacity}
      />

      {stopReason && !isStreaming && (
        <YStack paddingVertical={Spacing.xs} paddingHorizontal={Spacing.md} alignItems="center">
          <Text fontSize={FontSize.caption} fontStyle="italic" color={colors.textTertiary}>
            {stopReason === 'end_turn' || stopReason === 'stop'
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

      {/* Quote preview */}
      {quotedMessage && (
        <XStack
          paddingHorizontal={Spacing.lg}
          paddingVertical={Spacing.sm}
          backgroundColor={colors.cardBackground}
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor={colors.separator}
          alignItems="center"
          gap={Spacing.sm}
        >
          <View style={{ width: 3, height: '100%', backgroundColor: colors.primary, borderRadius: 2, minHeight: 24 }} />
          <YStack flex={1}>
            <Text fontSize={FontSize.caption} fontWeight="600" color={colors.primary}>
              {quotedMessage.role === 'user' ? 'You' : 'Assistant'}
            </Text>
            <Text fontSize={FontSize.caption} color={colors.textSecondary} numberOfLines={2}>
              {quotedMessage.content.slice(0, 120)}
            </Text>
          </YStack>
          <Pressable onPress={() => setQuotedMessage(null)} hitSlop={8}>
            <Text fontSize={FontSize.body} color={colors.textTertiary}>✕</Text>
          </Pressable>
        </XStack>
      )}

      {/* Server chip selector for multi-agent */}
      <ServerChipSelector
        servers={servers}
        selectedId={selectedServerId}
        onSelect={selectServer}
        colors={colors}
      />

      {/* Slash command autocomplete */}
      <View style={{ position: 'relative' }}>
        <SlashCommandAutocomplete
          visible={promptText.startsWith('/')}
          matches={slashMatches}
          onSelect={handleSelectTemplate}
          colors={colors}
        />
      </View>

      {/* Template icon + composer row */}
      <XStack alignItems="flex-end">
        <TouchableOpacity
          onPress={() => setTemplateSheetVisible(true)}
          style={{ paddingLeft: Spacing.md, paddingBottom: Spacing.lg }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Open prompt templates"
          accessibilityRole="button"
        >
          <PenLine size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
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
        </View>
      </XStack>

      <MessageActionMenu
        visible={!!actionMenuMessage}
        message={actionMenuMessage}
        onClose={() => setActionMenuMessage(null)}
        onEdit={handleEditStart}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onRegenerate={handleRegenerate}
        onBookmark={handleBookmark}
        isBookmarked={actionMenuMessage ? bookmarkedMessageIds.has(actionMenuMessage.id) : false}
        onExport={handleExportChat}
      />

      <CanvasPanel
        visible={!!canvasArtifact}
        artifact={canvasArtifact}
        onClose={() => setCanvasArtifact(null)}
      />

      <TemplatePickerSheet
        visible={templateSheetVisible}
        templates={BUILT_IN_TEMPLATES}
        onSelect={handleSelectTemplate}
        onClose={() => setTemplateSheetVisible(false)}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

const inlineEditStyles = StyleSheet.create({
  input: {
    fontSize: FontSize.body,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
});
