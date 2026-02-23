/**
 * Session detail screen — ChatGPT-style chat view with centered empty state.
 * Hooks extracted for scroll, search, composition, and message actions.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  RefreshControl,
  View,
  Modal,
} from 'react-native';
import { YStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { ChatBubble } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';
import { ModelPickerBar } from '../components/ModelPickerBar';
import { TypingIndicator } from '../components/TypingIndicator';
import { SkeletonMessage } from '../components/chat/SkeletonMessage';
import { MessageActionMenu } from '../components/chat/MessageActionMenu';
import { ScrollToBottomFab } from '../components/chat/ScrollToBottomFab';
import { SwipeableMessage } from '../components/chat/SwipeableMessage';
import { ChatSearchBar } from '../components/chat/ChatSearchBar';
import { ChatToolbar } from '../components/chat/ChatToolbar';
import { ProviderModelPicker } from '../components/chat/ProviderModelPicker';
import { CanvasPanel } from '../components/canvas/CanvasPanel';
import { TemplatePickerSheet } from '../components/chat/TemplatePickerSheet';
import { ABModelPicker } from '../components/chat/ABModelPicker';
import { ABCompareView } from '../components/chat/ABCompareView';
import { SlashCommandAutocomplete } from '../components/chat/SlashCommandAutocomplete';
import { ChatEmptyState } from '../components/chat/ChatEmptyState';
import { StreamingStatusBar } from '../components/chat/StreamingStatusBar';
import { InlineEditView } from '../components/chat/InlineEditView';
import { QuotedMessageBar } from '../components/chat/QuotedMessageBar';
import { ConsensusConfigSheet } from '../components/ConsensusConfigSheet';
import { ChatMessage, ACPConnectionState, ServerType } from '../acp/models/types';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing } from '../utils/theme';
import { useChatSpeech } from '../hooks/useChatSpeech';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useScrollToBottom, useChatSearch, useMessageActions, useComposition } from '../hooks/chat';
import { useABTesting } from '../hooks/useABTesting';
import { clearAll as clearNotifications } from '../services/notifications';
import {
  useChatMessages, useIsStreaming, usePromptText, useStopReason,
  useSelectedSessionId, useSelectedServerId, useServers,
  useConnectionState, useIsInitialized, useChatSearchVisible,
  useBookmarkedMessageIds,
  useSessionActions, useChatActions, useServerActions,
} from '../stores/selectors';
import { useAppStore } from '../stores/appStore';
import { getProviderInfo } from '../ai/providers';

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

  // Feature toggles (moved from header to toolbar)
  const agentModeEnabled = useAppStore(s => s.agentModeEnabled);
  const toggleAgentMode = useAppStore(s => s.toggleAgentMode);
  const consensusModeEnabled = useAppStore(s => s.consensusModeEnabled);
  const toggleConsensusMode = useAppStore(s => s.toggleConsensusMode);
  const isWatching = useAppStore(s => s.isWatching);
  const setScreenWatcherVisible = useAppStore(s => s.setScreenWatcherVisible);
  const terminalVisible = useAppStore(s => s.terminalVisible);
  const setTerminalVisible = useAppStore(s => s.setTerminalVisible);
  const updateServer = useAppStore(s => s.updateServer);
  const [consensusSheetVisible, setConsensusSheetVisible] = useState(false);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isAIProvider = selectedServer?.serverType === ServerType.AIProvider;
  const isConnected = isAIProvider || (connectionState === ACPConnectionState.Connected && isInitialized);

  // Provider•Model label for toolbar chip
  const currentModelLabel = React.useMemo(() => {
    if (!isAIProvider || !selectedServer?.aiProviderConfig) return '';
    const cfg = selectedServer.aiProviderConfig;
    return cfg.modelId?.split('/').pop() ?? cfg.modelId ?? '';
  }, [isAIProvider, selectedServer?.aiProviderConfig?.modelId]);

  const providerIcon = React.useMemo(() => {
    if (!isAIProvider || !selectedServer?.aiProviderConfig) return null;
    const Icon = getProviderInfo(selectedServer.aiProviderConfig.providerType).icon;
    return <Icon size={12} color={colors.textSecondary} />;
  }, [isAIProvider, selectedServer?.aiProviderConfig?.providerType, colors.textSecondary]);

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
    handleSaveAsTemplate,
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

  // ── A/B Testing ──
  const { abState, startTest, cancelTest, clearTest } = useABTesting();
  const [abPickerVisible, setAbPickerVisible] = useState(false);

  const handleABStart = useCallback((serverIds: string[]) => {
    const configs = serverIds
      .map(id => servers.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s?.aiProviderConfig)
      .map(s => ({
        config: s.aiProviderConfig!,
        apiKey: s.aiProviderConfig!.apiKey ?? '',
      }));
    if (configs.length < 2 || !promptText.trim()) return;
    startTest(promptText.trim(), chatMessages, configs);
    setPromptText('');
  }, [servers, promptText, chatMessages, startTest, setPromptText]);

  // ── TTS ──
  const { handleSpeak, isSpeakingMessage } = useChatSpeech();

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
        return (
          <InlineEditView
            isUserEdit={item.role === 'user'}
            editText={editText}
            setEditText={setEditText}
            onSubmit={handleEditSubmit}
            onCancel={handleEditCancel}
            colors={colors}
          />
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
            isSpeaking={isSpeakingMessage(item.id)}
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

  // Show skeleton shimmer while waiting for first assistant token
  const showSkeleton = isStreaming && chatMessages.length > 0 &&
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
        ListFooterComponent={showSkeleton ? <SkeletonMessage /> : showTyping ? <TypingIndicator /> : null}
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
        <QuotedMessageBar message={quotedMessage} onClear={clearQuote} colors={colors} />
      )}

      <ChatToolbar
        colors={colors}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={selectServer}
        onOpenTemplates={openTemplates}
        onOpenModelPicker={() => setModelPickerVisible(true)}
        currentModelLabel={currentModelLabel}
        providerIcon={providerIcon}
        onToggleAB={() => {
          if (abState.active) { clearTest(); }
          else { setAbPickerVisible(true); }
        }}
        abActive={abState.active}
        onToggleVoice={voiceAvailable ? toggleVoice : undefined}
        isListening={isListening}
        onToggleSearch={toggleChatSearch}
        searchActive={chatSearchVisible}
        onExport={handleExportChat}
        hasMessages={chatMessages.length > 0}
        onOpenTerminal={() => setTerminalVisible(true)}
        terminalActive={terminalVisible}
        onOpenScreenWatcher={() => setScreenWatcherVisible(true)}
        screenWatcherActive={isWatching}
        onToggleAgent={toggleAgentMode}
        agentActive={agentModeEnabled}
        onToggleConsensus={toggleConsensusMode}
        onConsensusLongPress={() => setConsensusSheetVisible(true)}
        consensusActive={consensusModeEnabled}
      />

      <View style={{ position: 'relative' }}>
        <SlashCommandAutocomplete
          visible={promptText.startsWith('/')}
          matches={slashMatches}
          onSelect={handleSelectTemplate}
          colors={colors}
        />
      </View>

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
        onSaveAsTemplate={handleSaveAsTemplate}
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

      <ABModelPicker
        visible={abPickerVisible}
        servers={servers}
        onStart={handleABStart}
        onClose={() => setAbPickerVisible(false)}
        colors={colors}
      />

      {abState.active && abState.results.length > 0 && (
        <Modal visible transparent animationType="slide">
          <ABCompareView
            state={abState}
            onClose={clearTest}
            colors={colors}
          />
        </Modal>
      )}

      <ConsensusConfigSheet
        visible={consensusSheetVisible}
        onClose={() => setConsensusSheetVisible(false)}
      />

      <ProviderModelPicker
        visible={modelPickerVisible}
        onClose={() => setModelPickerVisible(false)}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={selectServer}
        onUpdateServer={updateServer}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}
