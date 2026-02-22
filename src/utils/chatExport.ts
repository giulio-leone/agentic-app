/**
 * Chat export utilities — Markdown and JSON formats.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { ChatMessage } from '../acp/models/types';

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/** Export chat as Markdown. */
export function chatToMarkdown(messages: ChatMessage[], title?: string): string {
  const lines: string[] = [];
  lines.push(`# ${title || 'Chat Export'}`);
  lines.push(`_Exported on ${new Date().toLocaleString()}_\n`);
  lines.push('---\n');

  for (const msg of messages) {
    const role = msg.role === 'user' ? '**You**' : msg.role === 'assistant' ? '**Assistant**' : '_System_';
    const server = msg.serverName ? ` (${msg.serverName})` : '';
    lines.push(`### ${role}${server}`);
    lines.push(`_${formatTimestamp(msg.timestamp)}_\n`);
    lines.push(msg.content);
    if (msg.attachments && msg.attachments.length > 0) {
      lines.push('\n📎 Attachments:');
      for (const att of msg.attachments) {
        lines.push(`- ${att.name || 'file'} (${att.mediaType || 'unknown'})`);
      }
    }
    lines.push('\n---\n');
  }

  return lines.join('\n');
}

/** Export chat as JSON. */
export function chatToJSON(messages: ChatMessage[], title?: string): string {
  const data = {
    title: title || 'Chat Export',
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      serverId: m.serverId,
      serverName: m.serverName,
      ...(m.attachments?.length ? { attachments: m.attachments.map(a => ({ name: a.name, mediaType: a.mediaType, size: a.size })) } : {}),
    })),
  };
  return JSON.stringify(data, null, 2);
}

/** Write content to a temp file and open the share sheet. */
export async function shareExport(content: string, filename: string): Promise<void> {
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri, {
    mimeType: filename.endsWith('.json') ? 'application/json' : 'text/markdown',
    dialogTitle: 'Export Chat',
    UTI: filename.endsWith('.json') ? 'public.json' : 'net.daringfireball.markdown',
  });
}
