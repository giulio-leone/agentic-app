/**
 * Chat export utilities — Markdown, JSON, HTML, and PDF formats.
 */

import type { ChatMessage } from '../acp/models/types';

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

/** Export chat as styled HTML. */
export function chatToHTML(messages: ChatMessage[], title?: string): string {
  const t = title || 'Chat Export';
  const msgHtml = messages.map(msg => {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    const roleLabel = isUser ? 'You' : isSystem ? 'System' : (msg.serverName || 'Assistant');
    const bubbleClass = isUser ? 'user' : isSystem ? 'system' : 'assistant';
    const content = escapeHtml(msg.content).replace(/\n/g, '<br>');
    const attachments = (msg.attachments ?? []).map(a =>
      `<div class="attachment">📎 ${escapeHtml(a.name || 'file')} (${a.mediaType})</div>`
    ).join('');
    return `<div class="message ${bubbleClass}">
      <div class="role">${escapeHtml(roleLabel)}</div>
      <div class="time">${formatTimestamp(msg.timestamp)}</div>
      <div class="content">${content}</div>
      ${attachments}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; color: #333; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
    .message { padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; }
    .message.user { background: #DCF8C6; margin-left: 40px; }
    .message.assistant { background: #fff; margin-right: 40px; border: 1px solid #e0e0e0; }
    .message.system { background: transparent; text-align: center; color: #888; font-style: italic; font-size: 0.9rem; }
    .role { font-weight: 600; font-size: 0.85rem; color: #10A37F; margin-bottom: 2px; }
    .user .role { color: #1a73e8; }
    .time { font-size: 0.75rem; color: #aaa; margin-bottom: 6px; }
    .content { line-height: 1.5; color: #333; white-space: pre-wrap; word-break: break-word; }
    .attachment { font-size: 0.85rem; color: #666; margin-top: 6px; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t)}</h1>
  <div class="subtitle">Exported on ${new Date().toLocaleString()} · ${messages.length} messages</div>
  ${msgHtml}
</body>
</html>`;
}

/** Export chat as PDF using expo-print. Returns the file URI. */
export async function chatToPDF(messages: ChatMessage[], title?: string): Promise<string> {
  const Print = await import('expo-print');
  const html = chatToHTML(messages, title);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

/** Write content to a temp file and open the share sheet. */
export async function shareExport(content: string, filename: string): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
  const mimeMap: Record<string, string> = {
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.html': 'text/html',
  };
  const ext = filename.slice(filename.lastIndexOf('.'));
  await Sharing.shareAsync(fileUri, {
    mimeType: mimeMap[ext] || 'text/plain',
    dialogTitle: 'Export Chat',
  });
}

/** Share an already-created file (e.g., PDF). */
export async function shareFile(uri: string, mimeType: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Export Chat' });
}
