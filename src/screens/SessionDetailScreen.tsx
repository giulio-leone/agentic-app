/**
 * Session detail screen — ChatGPT-style chat view with centered empty state.
 * Hooks extracted for scroll, search, composition, and message actions.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  StyleSheet,
  RefreshControl,
  View,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { PenLine } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
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
import { ChatEmptyState } from '../components/chat/ChatEmptyState';
import { StreamingStatusBar } from '../components/chat/StreamingStatusBar';
import { ChatMessage, ACPConnectionState, ServerType } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { useSpeech } from '../hooks/useSpeech';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useScrollToBottom, useChatSearch, useMessageActions, useComposition } from '../hooks/chat';
import { clearAll as clearNotifications } from '../services/notifications';
import {
  useChatMessages, useIsStreaming, usePromptText, useStopReason,
  useSelectedSessionId, useSelectedServerId, useServers,
  useConnectionState, useIsInitialized, useChatSearchVisible,
  useBookmarkedMessageIds,
  useSessionActions, useChatActions, useServerActions,
} from '../stores/selectors';

const keyExtractor = (item: ChatMessage) => item.id;
const emptyListStyle = { flex: 1, justifyContent: 'center', alignItems: 'center' } as const;
const messageListStyle = { paddingVertical: Spacing.sm } as const;

export function SessionDetailScreen() {
  const { colors } = useDesignSystem();

  // Granular selectors — each only re-renders when its value changes
  const chatMessages = useChatMessages();
  const isStreaming = useIsStreaming();
  const promptText = usePromptText();
  const stopReason = useStopReason();
  const selectedSessionId = useSelectedSessionId();
  const selectedServerId = useSelectedServerId();
  const servers = useServers();
  const connectionState = useConnectionState();
  const isInitialized = useIsInitialized();
  const chatSearchVisible = useChatSearchVisible();
  const bookmarkedMessageIds = useBookmarkedMessageIds();

  const { sendPrompt, cancelPrompt, setPromptText, loadSessionMessages } = useSessionActions();
  const { editMessage, deleteMessage, regenerateMessage, toggleBookmark, loadBookmarks, toggleChatSearch } = useChatActions();
  const { selectServer, connect } = useServerActions();

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isAIProvider = selectedServer?.serverType === ServerType.AIProvider;
  const isConnected = isAIProvider || (connectionState === ACPConnectionState.Connected && isInitialized);

  // ── Custom hooks ──
  const {
    flatListRef,
    showFab,
    unreadCount,
    fabOpacity,
    handleScroll,
    scrollToBottom,
    markNearBottom,
  } = useScrollToBottom({ chatMessages, isStreaming });

  const {
    searchQuery,
    setSearchQuery,
    currentMatchIdx,
    searchMatches,
    searchMatchSet,
    handleSearchNext,
    handleSearchPrev,
    resetSearch,
  } = useChatSearch({ chatMessages, flatListRef });

  const {
    actionMenuMessage,
    editingMessageId,
    editText,
    setEditText,
    canvasArtifact,
    handleLongPress,
    handleOpenArtifact,
    handleCopy,
    handleDelete,
    handleRegenerate,
    handleBookmark,
    handleExportChat,
    handleEditStart,
    handleEditSubmit,
    handleEditCancel,
    closeActionMenu,
    closeCanvas,
  } = useMessageActions({
    chatMessages,
    isStreaming,
    editMessage,
    deleteMessage,
    regenerateMessage,
    toggleBookmark,
  });

  const {
    quotedMessage,
    templateSheetVisible,
    slashMatches,
    handleSelectTemplate,
    handleSuggestion,
    handleSwipeReply,
    handleSend,
    clearQuote,
    openTemplates,
    closeTemplates,
    builtInTemplates,
  } = useComposition({ promptText, setPromptText, sendPrompt, markNearBottom });

  // ── TTS ──
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

  // ── STT ──
  const onTranscript = useCallback((text: string) => setPromptText(text), [setPromptText]);
  const { isListening, toggle: toggleVoice, isAvailable: voiceAvailable } = useVoiceInput({
    onTranscript,
    onFinalTranscript: onTranscript,
  });

  // ── Load bookmarks + haptic on response complete + clear badge ──
  useEffect(() => { loadBookmarks(); clearNotifications(); }, [loadBookmarks]);

  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && chatMessages.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, chatMessages.length]);

  // ── Pull-to-refresh ──
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

  // ── Render message ──
  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
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
    [handleSpeak, handleLongPress, handleSwipeReply, isStreaming, editingMessageId, editText, colors, handleEditSubmit, handleEditCancel, handleOpenArtifact, searchMatchSet, bookmarkedMessageIds, setEditText],
  );

  const renderEmpty = useCallback(
    () => <ChatEmptyState isConnected={isConnected} colors={colors} onSuggestion={handleSuggestion} />,
    [isConnected, colors, handleSuggestion],
  );

  const showTyping = isStreaming && chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1]?.role === 'user';

  // Approximate token count from streaming message content (words ≈ tokens × 0.75)
  const streamingTokenCount = useMemo(() => {
    if (!isStreaming) return 0;
    const last = chatMessages[chatMessages.length - 1];
    if (!last?.isStreaming || !last.content) return 0;
    return Math.ceil(last.content.split(/\s+/).length * 1.33);
  }, [isStreaming, chatMessages]);

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
        onClose={() => { toggleChatSearch(); resetSearch(); }}
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

      <StreamingStatusBar visible={isStreaming && !showTyping} tokenCount={streamingTokenCount} />

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

      {isAIProvider && selectedServer && (
        <ModelPickerBar server={selectedServer} />
      )}

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
          <Pressable onPress={clearQuote} hitSlop={8}>
            <Text fontSize={FontSize.body} color={colors.textTertiary}>✕</Text>
          </Pressable>
        </XStack>
      )}

      <ServerChipSelector
        servers={servers}
        selectedId={selectedServerId}
        onSelect={selectServer}
        colors={colors}
      />

      <View style={{ position: 'relative' }}>
        <SlashCommandAutocomplete
          visible={promptText.startsWith('/')}
          matches={slashMatches}
          onSelect={handleSelectTemplate}
          colors={colors}
        />
      </View>

      <XStack alignItems="flex-end">
        <TouchableOpacity
          onPress={openTemplates}
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
        onClose={closeActionMenu}
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
        onClose={closeCanvas}
      />

      <TemplatePickerSheet
        visible={templateSheetVisible}
        templates={builtInTemplates}
        onSelect={handleSelectTemplate}
        onClose={closeTemplates}
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
