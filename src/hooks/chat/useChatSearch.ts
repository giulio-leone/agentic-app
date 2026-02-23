/**
 * Hook for in-chat search: query, matching, navigation between results.
 */

import { useCallback, useEffect, useMemo, useState, RefObject } from 'react';
import { FlatList } from 'react-native';
import { ChatMessage } from '../../acp/models/types';

interface UseChatSearchOptions {
  chatMessages: ChatMessage[];
  flatListRef: RefObject<FlatList<ChatMessage> | null>;
}

const EMPTY_MATCHES: number[] = [];

export function useChatSearch({ chatMessages, flatListRef }: UseChatSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return EMPTY_MATCHES;
    const q = searchQuery.toLowerCase();
    return chatMessages
      .map((m, i) => (m.content.toLowerCase().includes(q) ? i : -1))
      .filter(i => i !== -1);
  }, [chatMessages, searchQuery]);

  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

  const scrollToMatch = useCallback((idx: number) => {
    const messageIndex = searchMatches[idx];
    if (messageIndex != null) {
      flatListRef.current?.scrollToIndex({ index: messageIndex, animated: true, viewPosition: 0.5 });
    }
  }, [searchMatches, flatListRef]);

  const handleSearchNext = useCallback(() => {
    if (searchMatches.length === 0) return;
    const next = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(next);
    scrollToMatch(next);
  }, [searchMatches, currentMatchIdx, scrollToMatch]);

  const handleSearchPrev = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prev = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prev);
    scrollToMatch(prev);
  }, [searchMatches, currentMatchIdx, scrollToMatch]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIdx(0);
    if (searchMatches.length > 0) {
      scrollToMatch(0);
    }
  }, [searchQuery, searchMatches, scrollToMatch]);

  // Clamp match index when matches shrink
  useEffect(() => {
    if (searchMatches.length > 0 && currentMatchIdx >= searchMatches.length) {
      setCurrentMatchIdx(searchMatches.length - 1);
    }
  }, [searchMatches.length, currentMatchIdx]);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
    setCurrentMatchIdx(0);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    currentMatchIdx,
    searchMatches,
    searchMatchSet,
    handleSearchNext,
    handleSearchPrev,
    resetSearch,
  };
}
