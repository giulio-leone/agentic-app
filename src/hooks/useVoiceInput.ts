/**
 * useVoiceInput — Speech-to-Text hook using expo-speech-recognition.
 * Provides microphone recording with real-time transcription.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseVoiceInputOptions {
  language?: string;
  onTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { language = 'en-US', onTranscript, onFinalTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    checkAvailability().then(result => { if (!cancelled) setIsAvailable(result); });
    return () => { cancelled = true; };
  }, []);

  const checkAvailability = async (): Promise<boolean> => {
    try {
      return await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  };

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    if (lastTranscriptRef.current) {
      onFinalTranscript?.(lastTranscriptRef.current);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript || '';
    setTranscript(text);
    lastTranscriptRef.current = text;
    onTranscript?.(text);

    if (event.isFinal && text) {
      onFinalTranscript?.(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech recognition error:', event.error);
    setIsListening(false);
  });

  const startListening = useCallback(async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        console.warn('Speech recognition permission not granted');
        return false;
      }

      setTranscript('');
      lastTranscriptRef.current = '';

      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
      });

      return true;
    } catch (error) {
      console.warn('Failed to start speech recognition:', error);
      return false;
    }
  }, [language]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch { /* stop may fail if already stopped */
      // ignore
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isAvailable,
    startListening,
    stopListening,
    toggle,
  };
}
