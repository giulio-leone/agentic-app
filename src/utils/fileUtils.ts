/**
 * File utility functions — shared across components.
 */

import type { LucideIcon } from 'lucide-react-native';
import { Image, FileText, Table, FileSpreadsheet, Braces, Music, Video, File, Paperclip } from 'lucide-react-native';

/** Get Lucide icon component for a file's media type */
export function getFileIcon(mediaType: string): LucideIcon {
  if (mediaType.startsWith('image/')) return Image;
  if (mediaType === 'application/pdf') return FileText;
  if (mediaType.includes('spreadsheet') || mediaType.includes('excel') || mediaType === 'text/csv') return Table;
  if (mediaType.includes('word') || mediaType.includes('document')) return FileSpreadsheet;
  if (mediaType === 'application/json') return Braces;
  if (mediaType.startsWith('audio/')) return Music;
  if (mediaType.startsWith('video/')) return Video;
  if (mediaType.startsWith('text/')) return File;
  return Paperclip;
}

/** Format byte size to human-readable string */
export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
