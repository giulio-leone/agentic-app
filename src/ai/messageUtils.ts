/**
 * Message conversion utilities — transforms ChatMessage[] to AI SDK ModelMessage[].
 */

import { type ModelMessage } from 'ai';
import type { ChatMessage } from '../acp/models/types';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; mediaType?: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string };

export function toCoreMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map((msg) => {
      const hasAttachments = msg.attachments && msg.attachments.length > 0;

      if (!hasAttachments || msg.role !== 'user') {
        return { role: msg.role, content: msg.content };
      }

      const parts: ContentPart[] = [];

      if (msg.content.trim()) {
        parts.push({ type: 'text', text: msg.content });
      }

      for (const att of msg.attachments!) {
        if (!att.base64) continue;

        if (att.mediaType.startsWith('image/')) {
          parts.push({
            type: 'image',
            image: `data:${att.mediaType};base64,${att.base64}`,
            mediaType: att.mediaType,
          });
        } else {
          parts.push({
            type: 'file',
            data: att.base64,
            mediaType: att.mediaType,
            filename: att.name,
          });
        }
      }

      if (parts.length === 0) {
        return { role: msg.role, content: msg.content };
      }

      return { role: msg.role, content: parts as unknown as string };
    });
}
