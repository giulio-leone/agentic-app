/**
 * useABTesting — Hook for multi-model A/B comparison.
 * Sends the same prompt to 2+ models in parallel and tracks results.
 */

import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { streamChat } from '../ai/AIService';
import type { AIProviderConfig } from '../ai/types';
import type { ChatMessage } from '../acp/models/types';

export interface ABModelResult {
  id: string;
  config: AIProviderConfig;
  content: string;
  reasoning: string;
  isStreaming: boolean;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

export interface ABTestState {
  active: boolean;
  prompt: string;
  results: ABModelResult[];
}

const INITIAL_STATE: ABTestState = { active: false, prompt: '', results: [] };

export function useABTesting() {
  const [state, setState] = useState<ABTestState>(INITIAL_STATE);
  const controllersRef = useRef<AbortController[]>([]);

  const startTest = useCallback((
    prompt: string,
    contextMessages: ChatMessage[],
    configs: { config: AIProviderConfig; apiKey: string }[],
  ) => {
    // Abort any running test
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current = [];

    const results: ABModelResult[] = configs.map(({ config }) => ({
      id: uuidv4(),
      config,
      content: '',
      reasoning: '',
      isStreaming: true,
      error: null,
      startedAt: Date.now(),
      completedAt: null,
    }));

    setState({ active: true, prompt, results });

    // Launch parallel streams
    configs.forEach(({ config, apiKey }, idx) => {
      const controller = streamChat(
        [...contextMessages, { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date().toISOString() }],
        config,
        apiKey,
        // onChunk
        (chunk: string) => {
          setState(prev => ({
            ...prev,
            results: prev.results.map((r, i) =>
              i === idx ? { ...r, content: r.content + chunk } : r
            ),
          }));
        },
        // onComplete
        () => {
          setState(prev => ({
            ...prev,
            results: prev.results.map((r, i) =>
              i === idx ? { ...r, isStreaming: false, completedAt: Date.now() } : r
            ),
          }));
        },
        // onError
        (error: Error) => {
          setState(prev => ({
            ...prev,
            results: prev.results.map((r, i) =>
              i === idx ? { ...r, isStreaming: false, error: error.message, completedAt: Date.now() } : r
            ),
          }));
        },
        // onReasoning
        (chunk: string) => {
          setState(prev => ({
            ...prev,
            results: prev.results.map((r, i) =>
              i === idx ? { ...r, reasoning: r.reasoning + chunk } : r
            ),
          }));
        },
      );
      controllersRef.current.push(controller);
    });
  }, []);

  const cancelTest = useCallback(() => {
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current = [];
    setState(prev => ({
      ...prev,
      active: false,
      results: prev.results.map(r => ({ ...r, isStreaming: false })),
    }));
  }, []);

  const clearTest = useCallback(() => {
    controllersRef.current.forEach(c => c.abort());
    controllersRef.current = [];
    setState(INITIAL_STATE);
  }, []);

  return { abState: state, startTest, cancelTest, clearTest };
}
