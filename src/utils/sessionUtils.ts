/**
 * Session utility functions — shared across components.
 */

import type { SessionSummary } from '../acp-hex/domain/types';

export interface SessionGroup {
  label: string;
  data: SessionSummary[];
}

/** Group sessions by date buckets: Today, Yesterday, Previous 7 days, Older */
export function groupSessionsByDate(sessions: SessionSummary[]): SessionGroup[] {
  if (sessions.length === 0) return [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, SessionSummary[]> = {};

  for (const session of sessions) {
    const d = session.updatedAt ? new Date(session.updatedAt) : new Date();
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= weekAgo) label = 'Previous 7 days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label]!.push(session);
  }

  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  return order.filter(l => groups[l]).map(l => ({ label: l, data: groups[l]! }));
}
