/**
 * Deterministic color assignment for multi-agent server bubbles.
 * Each server gets a unique accent color based on its ID.
 */

const SERVER_PALETTE = [
  '#10A37F', // green (default primary)
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#EF4444', // red
] as const;

const SERVER_PALETTE_MUTED = [
  'rgba(16,163,127,0.12)',
  'rgba(99,102,241,0.12)',
  'rgba(236,72,153,0.12)',
  'rgba(245,158,11,0.12)',
  'rgba(59,130,246,0.12)',
  'rgba(139,92,246,0.12)',
  'rgba(20,184,166,0.12)',
  'rgba(239,68,68,0.12)',
] as const;

/** Simple stable hash from string → number. */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getServerColor(serverId: string): string {
  return SERVER_PALETTE[hashCode(serverId) % SERVER_PALETTE.length]!;
}

export function getServerColorMuted(serverId: string): string {
  return SERVER_PALETTE_MUTED[hashCode(serverId) % SERVER_PALETTE_MUTED.length]!;
}
