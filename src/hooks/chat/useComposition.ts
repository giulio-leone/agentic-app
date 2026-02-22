/**
 * Hook for message composition: send, quote/reply, templates, slash commands.
 */

import { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ChatMessage, Attachment } from '../../acp/models/types';
import { BUILT_IN_TEMPLATES, matchTemplates, type PromptTemplate } from '../../utils/promptTemplates';

interface UseCompositionOptions {
  promptText: string;
  setPromptText: (text: string) => void;
  sendPrompt: (text: string, attachments?: Attachment[]) => void;
  markNearBottom: () => void;
}

export function useComposition({
  promptText,
  setPromptText,
  sendPrompt,
  markNearBottom,
}: UseCompositionOptions) {
  const [quotedMessage, setQuotedMessage] = useState<ChatMessage | null>(null);
  const [templateSheetVisible, setTemplateSheetVisible] = useState(false);

  const slashMatches = useMemo(
    () => matchTemplates(promptText, BUILT_IN_TEMPLATES),
    [promptText],
  );

  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setPromptText(template.prompt);
    setTemplateSheetVisible(false);
  }, [setPromptText]);

  const handleSuggestion = useCallback((prompt: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromptText(prompt);
  }, [setPromptText]);

  const handleSwipeReply = useCallback((message: ChatMessage) => {
    setQuotedMessage(message);
  }, []);

  const handleSend = useCallback((attachments?: Attachment[]) => {
    const text = promptText.trim();
    if (!text && (!attachments || attachments.length === 0)) return;
    markNearBottom();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prefix = quotedMessage
      ? `> ${quotedMessage.content.slice(0, 200).replace(/\n/g, '\n> ')}\n\n`
      : '';
    sendPrompt(prefix + text, attachments);
    setQuotedMessage(null);
  }, [promptText, sendPrompt, quotedMessage, markNearBottom]);

  const clearQuote = useCallback(() => setQuotedMessage(null), []);
  const openTemplates = useCallback(() => setTemplateSheetVisible(true), []);
  const closeTemplates = useCallback(() => setTemplateSheetVisible(false), []);

  return {
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
    builtInTemplates: BUILT_IN_TEMPLATES,
  };
}
