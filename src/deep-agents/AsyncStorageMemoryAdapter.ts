/**
 * AsyncStorageMemoryAdapter — MemoryPort implementation backed by AsyncStorage.
 * Persists todos, checkpoints, conversations, and metadata across app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MemoryPort, Todo, Checkpoint, Message } from '@giulio-leone/gaussflow-agent';

const PREFIX = '@deep-agents:';

function key(sessionId: string, bucket: string): string {
  return `${PREFIX}${bucket}:${sessionId}`;
}

export class AsyncStorageMemoryAdapter implements MemoryPort {
  // -- Todos ------------------------------------------------------------------

  async saveTodos(sessionId: string, todos: Todo[]): Promise<void> {
    await AsyncStorage.setItem(key(sessionId, 'todos'), JSON.stringify(todos));
  }

  async loadTodos(sessionId: string): Promise<Todo[]> {
    const raw = await AsyncStorage.getItem(key(sessionId, 'todos'));
    return raw ? JSON.parse(raw) : [];
  }

  // -- Checkpoints ------------------------------------------------------------

  async saveCheckpoint(sessionId: string, checkpoint: Checkpoint): Promise<void> {
    const list = await this.listCheckpoints(sessionId);
    list.push(checkpoint);
    await AsyncStorage.setItem(key(sessionId, 'checkpoints'), JSON.stringify(list));
  }

  async loadLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    const list = await this.listCheckpoints(sessionId);
    return list.length > 0 ? list[list.length - 1]! : null;
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    const raw = await AsyncStorage.getItem(key(sessionId, 'checkpoints'));
    return raw ? JSON.parse(raw) : [];
  }

  async deleteOldCheckpoints(sessionId: string, keepCount: number): Promise<void> {
    const list = await this.listCheckpoints(sessionId);
    if (list.length <= keepCount) return;
    await AsyncStorage.setItem(
      key(sessionId, 'checkpoints'),
      JSON.stringify(list.slice(-keepCount)),
    );
  }

  // -- Conversation -----------------------------------------------------------

  async saveConversation(sessionId: string, messages: Message[]): Promise<void> {
    await AsyncStorage.setItem(key(sessionId, 'conversation'), JSON.stringify(messages));
  }

  async loadConversation(sessionId: string): Promise<Message[]> {
    const raw = await AsyncStorage.getItem(key(sessionId, 'conversation'));
    return raw ? JSON.parse(raw) : [];
  }

  // -- Metadata ---------------------------------------------------------------

  async saveMetadata(sessionId: string, k: string, value: unknown): Promise<void> {
    const metaKey = `${key(sessionId, 'meta')}:${k}`;
    await AsyncStorage.setItem(metaKey, JSON.stringify(value));
  }

  async loadMetadata<T = unknown>(sessionId: string, k: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(`${key(sessionId, 'meta')}:${k}`);
    return raw ? JSON.parse(raw) : null;
  }

  async deleteMetadata(sessionId: string, k: string): Promise<void> {
    await AsyncStorage.removeItem(`${key(sessionId, 'meta')}:${k}`);
  }

  // -- Utility ----------------------------------------------------------------

  async clear(sessionId: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => k.startsWith(`${PREFIX}`) && k.includes(`:${sessionId}`));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  }

  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => k.startsWith(PREFIX));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  }
}
