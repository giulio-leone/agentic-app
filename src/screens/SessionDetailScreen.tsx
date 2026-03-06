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
import { YStack, XStack, Text, Button } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { ChatBubble } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';
import { TypingIndicator } from '../components/TypingIndicator';
import { SkeletonMessage } from '../components/chat/SkeletonMessage';
import { MessageActionMenu } from '../components/chat/MessageActionMenu';
import { ScrollToBottomFab } from '../components/chat/ScrollToBottomFab';
import { SwipeableMessage } from '../components/chat/SwipeableMessage';
import { ChatSearchBar } from '../components/chat/ChatSearchBar';
import { ChatToolbar } from '../components/chat/ChatToolbar';
import { ProviderModelPicker } from '../components/chat/ProviderModelPicker';
import { ReasoningEffortPicker } from '../components/chat/ReasoningEffortPicker';
import { DirectoryPicker } from '../components/chat/DirectoryPicker';
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
import { ChatMessage, ACPConnectionState, ServerType, type ACPServerConfiguration } from '../acp-hex/domain/types';
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
import { AIProviderType, type ReasoningEffort } from '../ai/types';

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
  const bridgeModels = useAppStore(s => s.bridgeModels);
  const storeReasoningLevels = useAppStore(s => s.reasoningEffortLevels);
  const reasoningEffortLevels = storeReasoningLevels.length > 0
    ? storeReasoningLevels
    : bridgeModels.length > 0 ? ['low', 'medium', 'high', 'xhigh'] : [];
  const selectedBridgeModel = useAppStore(s => s.selectedBridgeModel);
  const selectedReasoningEffort = useAppStore(s => s.selectedReasoningEffort);
  const setSelectedBridgeModel = useAppStore(s => s.setSelectedBridgeModel);
  const setSelectedReasoningEffort = useAppStore(s => s.setSelectedReasoningEffort);
  const selectedCwd = useAppStore(s => s.selectedCwd);
  const setSelectedCwd = useAppStore(s => s.setSelectedCwd);
  const listDirectory = useAppStore(s => s.listDirectory);
  const [consensusSheetVisible, setConsensusSheetVisible] = useState(false);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [reasoningPickerVisible, setReasoningPickerVisible] = useState(false);
  const [directoryPickerVisible, setDirectoryPickerVisible] = useState(false);

  const selectedServer = servers.find(s => s.id === selectedServerId);
  const isAIProvider = selectedServer?.serverType === ServerType.AIProvider;
  const isChatBridgeServer = selectedServer?.serverType === ServerType.ChatBridge;
  const isCliSession = !isChatBridgeServer && !!selectedSessionId?.startsWith('cli:');
  const activePtySessionId = useAppStore(s => s.activePtySessionId);
  const ptyOwnerCliSessionId = useAppStore(s => s.ptyOwnerCliSessionId);
  const writeToCopilotPty = useAppStore(s => s.writeToCopilotPty);
  const spawnCopilotCli = useAppStore(s => s.spawnCopilotCli);
  const killCopilotPty = useAppStore(s => s.killCopilotPty);
  const cliSessions = useAppStore(s => s.cliSessions);
  const isPtySession = isCliSession && !!activePtySessionId && selectedSessionId === `cli:${ptyOwnerCliSessionId}`;
  const selectedCliSession = isCliSession
    ? cliSessions.find(s => selectedSessionId === `cli:${s.id}`)
    : undefined;
  const isConnected = isAIProvider || (connectionState === ACPConnectionState.Connected && isInitialized);
  const isCopilotProvider = (
    isAIProvider && selectedServer?.aiProviderConfig?.providerType === AIProviderType.Copilot
  ) || (
    isChatBridgeServer && (selectedBridgeModel ?? selectedServer?.aiProviderConfig?.modelId) === 'copilot'
  );

  // Provider•Model label for toolbar chip
  const currentModelLabel = React.useMemo(() => {
    if (bridgeModels.length > 0 && selectedBridgeModel) {
      const suffix = selectedReasoningEffort ? ` (${selectedReasoningEffort})` : '';
      return selectedBridgeModel.split('/').pop() + suffix;
    }
    if (!isAIProvider || !selectedServer?.aiProviderConfig) return '';
    const cfg = selectedServer.aiProviderConfig;
    const modelName = cfg.modelId?.split('/').pop() ?? cfg.modelId ?? '';
    if (isCopilotProvider && cfg.reasoningEffort) {
      return `${modelName} (${cfg.reasoningEffort})`;
    }
    return modelName;
  }, [isAIProvider, isCopilotProvider, selectedServer, bridgeModels, selectedBridgeModel, selectedReasoningEffort]);

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
  } = useChatSearch({ chatMessages, flatListRef, isStreaming });

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

  // CLI prompt: auto-spawn → write prompt → close stdin → stream output → process exits
  const ptyAwareSendPrompt = useCallback(async (text: string, attachments?: import('../acp-hex/domain/types').Attachment[]) => {
    if (!isCliSession) {
      sendPrompt(text, attachments);
      return;
    }

    // Add user message to chat
    useAppStore.setState(state => ({
      chatMessages: [...state.chatMessages, {
        id: `pty-user-${Date.now()}`,
        role: 'user' as const,
        content: text,
        timestamp: new Date().toISOString(),
      }],
    }));

    // If PTY active, write to it (shouldn't happen normally — each prompt is one-shot)
    if (isPtySession && activePtySessionId) {
      await writeToCopilotPty(activePtySessionId, text + '\n', true);
      return;
    }

    // Auto-spawn a new copilot process for this prompt
    const cwd = selectedCliSession?.cwd || '/tmp';
    const cliId = selectedCliSession?.id;
    const ptyId = await spawnCopilotCli(cwd, cliId);
    if (ptyId) {
      await writeToCopilotPty(ptyId, text + '\n', true);
    }
  }, [isCliSession, isPtySession, activePtySessionId, writeToCopilotPty, sendPrompt, selectedCliSession, spawnCopilotCli]);

  const [isSpawning, setIsSpawning] = useState(false);
  const handleSpawnCli = useCallback(async () => {
    const cwd = selectedCliSession?.cwd || '/tmp';
    const cliId = selectedCliSession?.id;
    setIsSpawning(true);
    try {
      await spawnCopilotCli(cwd, cliId);
    } finally {
      setIsSpawning(false);
    }
  }, [selectedCliSession, spawnCopilotCli]);

  const handleStopCli = useCallback(async () => {
    if (activePtySessionId) await killCopilotPty(activePtySessionId);
  }, [activePtySessionId, killCopilotPty]);

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
  } = useComposition({ promptText, setPromptText, sendPrompt: ptyAwareSendPrompt, markNearBottom });

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

  const handleCloseSearch = useCallback(
    () => { toggleChatSearch(); resetSearch(); },
    [toggleChatSearch, resetSearch],
  );

  const handleOpenModelPicker = useCallback(() => {
    setModelPickerVisible(true);
  }, []);

  const handleLongPressModelPicker = useCallback(() => {
    if (bridgeModels.length > 0 && reasoningEffortLevels.length > 0) {
      setReasoningPickerVisible(true);
    } else if (isCopilotProvider) {
      setReasoningPickerVisible(true);
    }
  }, [bridgeModels, reasoningEffortLevels, isCopilotProvider]);

  const handleToggleAB = useCallback(() => {
    if (abState.active) { clearTest(); }
    else { setAbPickerVisible(true); }
  }, [abState.active, clearTest]);

  const handleOpenTerminal = useCallback(() => setTerminalVisible(true), [setTerminalVisible]);

  const handleOpenScreenWatcher = useCallback(() => setScreenWatcherVisible(true), [setScreenWatcherVisible]);

  const handleConsensusLongPress = useCallback(() => setConsensusSheetVisible(true), []);

  const handleCloseAbPicker = useCallback(() => setAbPickerVisible(false), []);
  const handleCloseConsensusSheet = useCallback(() => setConsensusSheetVisible(false), []);
  const handleCloseModelPicker = useCallback(() => {
    setModelPickerVisible(false);
    // After selecting a bridge model, open reasoning effort picker
    if (bridgeModels.length > 0 && reasoningEffortLevels.length > 0) {
      setTimeout(() => setReasoningPickerVisible(true), 300);
    } else if (isCopilotProvider) {
      setTimeout(() => setReasoningPickerVisible(true), 300);
    }
  }, [bridgeModels, reasoningEffortLevels, isCopilotProvider]);

  const handleUpdateServer = useCallback(async (server: ACPServerConfiguration) => {
    await updateServer(server);
  }, [updateServer]);

  const handleCopilotReasoningSelect = useCallback((level: string | null) => {
    if (isCopilotProvider && selectedServer?.aiProviderConfig) {
      updateServer({
        ...selectedServer,
        aiProviderConfig: {
          ...selectedServer.aiProviderConfig,
          reasoningEffort: (level as ReasoningEffort) ?? undefined,
        },
      });
    } else {
      setSelectedReasoningEffort(level);
    }
  }, [isCopilotProvider, selectedServer, updateServer, setSelectedReasoningEffort]);

  // Copilot reasoning effort levels & current selection
  const copilotReasoningLevels = useMemo(
    () => ['low', 'medium', 'high', 'xhigh'],
    [],
  );
  const effectiveReasoningLevels = isCopilotProvider ? copilotReasoningLevels : reasoningEffortLevels;
  const effectiveReasoningSelection = isCopilotProvider
    ? (selectedServer?.aiProviderConfig?.reasoningEffort ?? null)
    : selectedReasoningEffort;
  const effectiveReasoningModel = isCopilotProvider
    ? (selectedServer?.aiProviderConfig?.modelId ?? null)
    : selectedBridgeModel;

  const { handleSpeak, isSpeakingMessage, speakingMessageId } = useChatSpeech();

  // ── STT ──
  const onTranscript = useCallback((text: string) => setPromptText(text), [setPromptText]);
  const { isListening, toggle: toggleVoice, isAvailable: voiceAvailable } = useVoiceInput({
    onTranscript,
    onFinalTranscript: onTranscript,
  });

  // ── Load bookmarks + haptic on response complete + clear badge ──
  useEffect(() => { loadBookmarks(); clearNotifications(); }, [loadBookmarks, clearNotifications]);

  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && chatMessages.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, chatMessages.length]);

  // ── Pull-to-refresh ──
  const refreshColors = useMemo(() => [colors.primary], [colors.primary]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => setRefreshing(false), 400);
    }
  }, [isAIProvider, connectionState, connect, loadSessionMessages, selectedSessionId]);

  useEffect(() => {
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

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
          message={item}
          onSwipeReply={handleSwipeReply}
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
    [handleSpeak, handleLongPress, handleSwipeReply, isStreaming, editingMessageId, editText, colors, handleEditSubmit, handleEditCancel, handleOpenArtifact, searchMatchSet, bookmarkedMessageIds, setEditText, isSpeakingMessage],
  );

  // Stable extraData to minimize full FlatList re-renders
  const extraData = useMemo(
    () => ({ isStreaming, editingMessageId, searchMatchSet, bookmarkedMessageIds, speakingMessageId }),
    [isStreaming, editingMessageId, searchMatchSet, bookmarkedMessageIds, speakingMessageId],
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
    // O(1) estimate: ~5 chars per word, ~1.33 tokens per word
    return Math.ceil((last.content.length / 5) * 1.33);
  }, [isStreaming, chatMessages]);

  const containerStyle = useMemo(
    () => ({ flex: 1, backgroundColor: colors.background } as const),
    [colors.background],
  );

  const handleScrollToIndexFailed = useCallback((info: { averageItemLength: number; index: number }) => {
    flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
  }, []);

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
        onClose={handleCloseSearch}
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
        extraData={extraData}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={showSkeleton ? <SkeletonMessage /> : showTyping ? <TypingIndicator /> : null}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        contentContainerStyle={
          chatMessages.length === 0 ? emptyListStyle : messageListStyle
        }
        onScroll={handleScroll}
        scrollEventThrottle={100}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        initialNumToRender={12}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={refreshColors}
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

      {quotedMessage && (
        <QuotedMessageBar message={quotedMessage} onClear={clearQuote} colors={colors} />
      )}

      {/* Connection status banner for ChatBridge */}
      {isChatBridgeServer && connectionState === ACPConnectionState.Connecting && (
        <XStack paddingVertical={4} paddingHorizontal={Spacing.md} backgroundColor={`${colors.orange}15`} alignItems="center" justifyContent="center" gap={4}>
          <Text fontSize={12} color={colors.orange}>⟳ Connecting to bridge…</Text>
        </XStack>
      )}
      {isChatBridgeServer && connectionState === ACPConnectionState.Disconnected && !isConnected && (
        <XStack
          paddingVertical={6}
          paddingHorizontal={Spacing.md}
          backgroundColor={`${colors.destructive}10`}
          alignItems="center"
          justifyContent="center"
          gap={6}
          pressStyle={{ opacity: 0.7 }}
          onPress={connect}
        >
          <Text fontSize={12} color={colors.destructive}>⚠ Not connected</Text>
          <Text fontSize={11} color={colors.textTertiary}>Tap to reconnect</Text>
        </XStack>
      )}

      <ChatToolbar
        colors={colors}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={selectServer}
        onOpenTemplates={openTemplates}
        onOpenModelPicker={isCliSession ? undefined : handleOpenModelPicker}
        onLongPressModelPicker={isCliSession ? undefined : handleLongPressModelPicker}
        onOpenDirectoryPicker={!isCliSession && bridgeModels.length > 0 ? () => { console.warn('[DIR] Opening directory picker'); setDirectoryPickerVisible(true); } : undefined}
        currentModelLabel={isCliSession ? '🖥 CLI' : currentModelLabel}
        currentCwdLabel={selectedCwd ? selectedCwd.split('/').pop() : null}
        providerIcon={providerIcon}
        onToggleAB={handleToggleAB}
        abActive={abState.active}
        onToggleVoice={voiceAvailable ? toggleVoice : undefined}
        isListening={isListening}
        onToggleSearch={toggleChatSearch}
        searchActive={chatSearchVisible}
        onExport={handleExportChat}
        hasMessages={chatMessages.length > 0}
        onOpenTerminal={handleOpenTerminal}
        terminalActive={terminalVisible}
        onOpenScreenWatcher={handleOpenScreenWatcher}
        screenWatcherActive={isWatching}
        onToggleAgent={toggleAgentMode}
        agentActive={agentModeEnabled}
        onToggleConsensus={toggleConsensusMode}
        onConsensusLongPress={handleConsensusLongPress}
        consensusActive={consensusModeEnabled}
      />

      <View style={styles.relativeContainer}>
        <SlashCommandAutocomplete
          visible={promptText.startsWith('/')}
          matches={slashMatches}
          onSelect={handleSelectTemplate}
          colors={colors}
        />
      </View>

      {isCliSession && !isPtySession && isConnected && (
        <XStack
          paddingHorizontal={Spacing.md}
          paddingVertical={Spacing.sm}
          gap={Spacing.sm}
          alignItems="center"
          justifyContent="center"
        >
          <Button
            size="$3"
            theme="active"
            backgroundColor={colors.primary}
            borderRadius={12}
            onPress={handleSpawnCli}
            disabled={isSpawning}
          >
            {isSpawning ? '⏳ Avvio...' : '▶ Avvia Copilot CLI'}
          </Button>
        </XStack>
      )}

      {isPtySession && (
        <XStack
          paddingHorizontal={Spacing.md}
          paddingVertical={Spacing.xs}
          gap={Spacing.sm}
          alignItems="center"
          justifyContent="space-between"
        >
          <Text fontSize={FontSize.caption} color={colors.primary} fontWeight="600">
            🟢 PTY attivo
          </Text>
          <Button size="$2" theme="red" borderRadius={8} onPress={handleStopCli}>
            ⏹ Stop
          </Button>
        </XStack>
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
        placeholder={isCliSession && !isPtySession ? 'CLI session — avvia PTY per interagire' : isPtySession ? 'Invia prompt a Copilot CLI...' : undefined}
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
        onClose={handleCloseAbPicker}
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
        onClose={handleCloseConsensusSheet}
      />

      <ProviderModelPicker
        visible={modelPickerVisible}
        onClose={handleCloseModelPicker}
        servers={servers}
        selectedServerId={selectedServerId}
        bridgeModels={bridgeModels}
        selectedBridgeModel={selectedBridgeModel}
        onSelectServer={selectServer}
        onUpdateServer={handleUpdateServer}
        onSelectBridgeModel={setSelectedBridgeModel}
        colors={colors}
      />

      <ReasoningEffortPicker
        visible={reasoningPickerVisible}
        onClose={() => setReasoningPickerVisible(false)}
        levels={effectiveReasoningLevels}
        selectedLevel={effectiveReasoningSelection}
        selectedModel={effectiveReasoningModel}
        onSelect={handleCopilotReasoningSelect}
        colors={colors}
      />

      <DirectoryPicker
        visible={directoryPickerVisible}
        onClose={() => setDirectoryPickerVisible(false)}
        selectedPath={selectedCwd}
        onSelect={setSelectedCwd}
        listDirectory={listDirectory}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  relativeContainer: { position: 'relative' },
});
