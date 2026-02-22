/**
 * Hook for message CRUD: long-press menu, edit, copy, delete, regenerate, bookmark, export.
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { ChatMessage, Artifact } from '../../acp/models/types';
import { chatToMarkdown, chatToJSON, shareExport } from '../../utils/chatExport';

interface UseMessageActionsOptions {
  chatMessages: ChatMessage[];
  isStreaming: boolean;
  editMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  regenerateMessage: (id: string) => void;
  toggleBookmark: (id: string) => void;
}

export function useMessageActions({
  chatMessages,
  isStreaming,
  editMessage,
  deleteMessage,
  regenerateMessage,
  toggleBookmark,
}: UseMessageActionsOptions) {
  const [actionMenuMessage, setActionMenuMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [canvasArtifact, setCanvasArtifact] = useState<Artifact | null>(null);

  const handleLongPress = useCallback((message: ChatMessage) => {
    if (isStreaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionMenuMessage(message);
  }, [isStreaming]);

  const handleOpenArtifact = useCallback((artifact: Artifact) => {
    setCanvasArtifact(artifact);
  }, []);

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

  const closeActionMenu = useCallback(() => setActionMenuMessage(null), []);
  const closeCanvas = useCallback(() => setCanvasArtifact(null), []);

  return {
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
  };
}
