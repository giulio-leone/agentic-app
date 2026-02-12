/**
 * Shared helpers used by multiple store slices.
 */

import type { ChatMessage, Artifact, ArtifactType } from '../acp/models/types';

// ─── Artifact Detection ───

const ARTIFACT_LANGS: Record<string, ArtifactType> = {
  html: 'html',
  htm: 'html',
  svg: 'svg',
  mermaid: 'mermaid',
  csv: 'csv',
  markdown: 'markdown',
  md: 'markdown',
};

export function detectArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1]?.toLowerCase() ?? '';
    const code = match[2].trim();
    if (code.length < 100) continue;

    const artifactType: ArtifactType = ARTIFACT_LANGS[lang] ?? 'code';
    const title = lang ? `${lang.charAt(0).toUpperCase() + lang.slice(1)} artifact` : `Code artifact`;

    artifacts.push({
      id: `art-${idx++}`,
      type: artifactType,
      title,
      content: code,
      language: lang || undefined,
    });
  }

  return artifacts;
}

// ─── Immutable Message Update Helper ───

export function updateMessageById(
  messages: ChatMessage[],
  id: string,
  updater: (msg: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) return messages;
  const updated = updater(messages[idx]!);
  if (updated === messages[idx]) return messages;
  const next = messages.slice();
  next[idx] = updated;
  return next;
}
