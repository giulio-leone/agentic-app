/**
 * useChatSpeech — TTS speech toggle for chat messages.
 */

import { useState, useRef, useCallback } from 'react';
import { useSpeech } from './useSpeech';

export function useChatSpeech() {
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

  const isSpeakingMessage = useCallback(
    (messageId: string) => speakingRef.current.isSpeaking && speakingRef.current.speakingMessageId === messageId,
    [],
  );

  return { handleSpeak, isSpeakingMessage, speakingRef };
}
