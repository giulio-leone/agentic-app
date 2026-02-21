/**
 * VirtualFilesystemRN — In-memory filesystem for React Native.
 * Same API as VirtualFilesystem from @onegenui/deep-agents but without
 * node:fs/path dependencies. No syncToPersistent (no disk on RN).
 */

import type {
  FilesystemPort,
  FileEntry,
  FileStat,
  FilesystemZone,
  ListOptions,
  SearchOptions,
  SearchResult,
} from '@giulio-leone/gaussflow-agent';

interface StoredEntry {
  content: string;
  isDirectory: boolean;
  createdAt: number;
  modifiedAt: number;
}

function normalizePath(p: string): string {
  // Simple POSIX-like normalization without node:path
  return p
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function globToRegex(pattern: string): RegExp {
  let re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '⟨GLOBSTAR⟩')
    .replace(/\*/g, '[^/]*')
    .replace(/⟨GLOBSTAR⟩/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${re}$`);
}

export class VirtualFilesystemRN implements FilesystemPort {
  private readonly zones: Record<FilesystemZone, Map<string, StoredEntry>> = {
    transient: new Map(),
    persistent: new Map(),
  };

  async read(path: string, zone: FilesystemZone = 'transient'): Promise<string> {
    const entry = this.zones[zone].get(normalizePath(path));
    if (!entry || entry.isDirectory) {
      throw new Error(`File not found: ${path}`);
    }
    return entry.content;
  }

  async write(path: string, content: string, zone: FilesystemZone = 'transient'): Promise<void> {
    const normalized = normalizePath(path);
    this.ensureParentDirs(normalized, zone);
    const now = Date.now();
    const existing = this.zones[zone].get(normalized);
    this.zones[zone].set(normalized, {
      content,
      isDirectory: false,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
    });
  }

  async exists(path: string, zone: FilesystemZone = 'transient'): Promise<boolean> {
    return this.zones[zone].has(normalizePath(path));
  }

  async delete(path: string, zone: FilesystemZone = 'transient'): Promise<void> {
    const normalized = normalizePath(path);
    const store = this.zones[zone];
    const prefix = normalized.endsWith('/') ? normalized : normalized + '/';
    for (const key of store.keys()) {
      if (key === normalized || key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  }

  async list(
    path: string,
    options: ListOptions = {},
    zone: FilesystemZone = 'transient',
  ): Promise<FileEntry[]> {
    const normalized = normalizePath(path);
    const prefix = normalized === '' ? '' : normalized + '/';
    const maxDepth = options.maxDepth ?? (options.recursive ? Infinity : 1);
    const results: FileEntry[] = [];

    for (const [key, entry] of this.zones[zone]) {
      if (!key.startsWith(prefix) || key === normalized) continue;
      const relative = key.slice(prefix.length);
      if (!options.includeHidden && relative.split('/').some(s => s.startsWith('.'))) continue;
      const depth = relative.split('/').length;
      if (depth > maxDepth) continue;
      results.push({
        name: relative.split('/').pop()!,
        path: key,
        isDirectory: entry.isDirectory,
        size: entry.content.length,
        modifiedAt: entry.modifiedAt,
      });
    }
    return results;
  }

  async stat(path: string, zone: FilesystemZone = 'transient'): Promise<FileStat> {
    const entry = this.zones[zone].get(normalizePath(path));
    if (!entry) throw new Error(`Not found: ${path}`);
    return {
      size: entry.content.length,
      isDirectory: entry.isDirectory,
      isFile: !entry.isDirectory,
      createdAt: entry.createdAt,
      modifiedAt: entry.modifiedAt,
    };
  }

  async glob(pattern: string, zone: FilesystemZone = 'transient'): Promise<string[]> {
    const regex = globToRegex(pattern);
    const results: string[] = [];
    for (const [key, entry] of this.zones[zone]) {
      if (!entry.isDirectory && regex.test(key)) {
        results.push(key);
      }
    }
    return results;
  }

  async search(
    pattern: string,
    options: SearchOptions = {},
    zone: FilesystemZone = 'transient',
  ): Promise<SearchResult[]> {
    const flags = options.caseSensitive === false ? 'gi' : 'g';
    const regex = new RegExp(pattern, flags);
    const fileRegex = options.filePattern ? globToRegex(options.filePattern) : null;
    const results: SearchResult[] = [];
    const max = options.maxResults ?? Infinity;

    for (const [filePath, entry] of this.zones[zone]) {
      if (entry.isDirectory) continue;
      if (fileRegex && !fileRegex.test(filePath)) continue;
      const lines = entry.content.split('\n');
      for (let i = 0; i < lines.length && results.length < max; i++) {
        regex.lastIndex = 0;
        const match = regex.exec(lines[i]!);
        if (match) {
          results.push({
            filePath,
            lineNumber: i + 1,
            lineContent: lines[i]!,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
        }
      }
      if (results.length >= max) break;
    }
    return results;
  }

  async clearTransient(): Promise<void> {
    this.zones.transient.clear();
  }

  private ensureParentDirs(filePath: string, zone: FilesystemZone): void {
    const parts = filePath.split('/');
    const now = Date.now();
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/');
      if (dirPath && !this.zones[zone].has(dirPath)) {
        this.zones[zone].set(dirPath, {
          content: '',
          isDirectory: true,
          createdAt: now,
          modifiedAt: now,
        });
      }
    }
  }
}
