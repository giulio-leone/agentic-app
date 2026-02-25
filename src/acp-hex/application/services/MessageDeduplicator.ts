import type { MessageId, SessionId } from '../../domain';

/**
 * Filter-based deduplicator for CLI delta messages.
 * Prevents duplicate messages after reconnection or navigation.
 * O(1) lookups via Set per session.
 */
export class MessageDeduplicator {
  private seenMessages = new Map<string, Set<string>>();
  private lastTurnIndex = new Map<string, number>();

  /** Returns true if this message was already seen (duplicate). */
  isDuplicate(sessionId: SessionId | string, messageId: MessageId | string): boolean {
    const sKey = String(sessionId);
    const mKey = String(messageId);

    let seen = this.seenMessages.get(sKey);
    if (!seen) {
      seen = new Set();
      this.seenMessages.set(sKey, seen);
    }

    if (seen.has(mKey)) return true;
    seen.add(mKey);
    return false;
  }

  /** Track turn index and detect gaps after reconnection. */
  trackTurn(
    sessionId: SessionId | string,
    turnIndex: number,
  ): { hasGap: boolean; missingFrom?: number } {
    const sKey = String(sessionId);
    const last = this.lastTurnIndex.get(sKey) ?? -1;

    if (turnIndex > last + 1) {
      return { hasGap: true, missingFrom: last + 1 };
    }

    this.lastTurnIndex.set(sKey, Math.max(last, turnIndex));
    return { hasGap: false };
  }

  /** Clear tracking data for a single session (e.g. on full reload). */
  clearSession(sessionId: SessionId | string): void {
    const sKey = String(sessionId);
    this.seenMessages.delete(sKey);
    this.lastTurnIndex.delete(sKey);
  }

  /** Clear all tracking data. */
  reset(): void {
    this.seenMessages.clear();
    this.lastTurnIndex.clear();
  }
}

export const messageDeduplicator = new MessageDeduplicator();
