import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolManager, isPathSafe } from './tools.js';

describe('ToolManager', () => {
  let mgr: ToolManager;

  beforeEach(() => {
    mgr = new ToolManager();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ── resolveToolCall ──

  it('resolveToolCall resolves pending promise', async () => {
    const promise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      mgr.register({ toolCallId: 'tc-1', resolve, reject, timeout });
    });

    mgr.resolveToolCall('tc-1', { response: 'yes' });
    await expect(promise).resolves.toEqual({ response: 'yes' });
    expect(mgr.size).toBe(0);
  });

  it('resolveToolCall is no-op for unknown id', () => {
    // Should not throw
    mgr.resolveToolCall('unknown', {});
    expect(mgr.size).toBe(0);
  });

  // ── rejectToolCall ──

  it('rejectToolCall rejects pending promise', async () => {
    const promise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      mgr.register({ toolCallId: 'tc-2', resolve, reject, timeout });
    });

    mgr.rejectToolCall('tc-2', 'User declined');
    await expect(promise).rejects.toThrowError('User declined');
    expect(mgr.size).toBe(0);
  });

  it('rejectToolCall is no-op for unknown id', () => {
    mgr.rejectToolCall('unknown', 'err');
    expect(mgr.size).toBe(0);
  });

  // ── Timeout ──

  it('timeout clears pending tool call', async () => {
    vi.useFakeTimers();

    const promise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        mgr.rejectToolCall('tc-3', 'Timeout');
        reject(new Error('Timeout'));
      }, 1000);
      mgr.register({ toolCallId: 'tc-3', resolve, reject, timeout });
    });

    expect(mgr.size).toBe(1);
    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrowError('Timeout');
    expect(mgr.size).toBe(0);

    vi.useRealTimers();
  });

  // ── cancelAll ──

  it('cancelAll rejects all pending', async () => {
    const promises: Promise<unknown>[] = [];

    for (const id of ['a', 'b', 'c']) {
      promises.push(
        new Promise<unknown>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
          mgr.register({ toolCallId: id, resolve, reject, timeout });
        }),
      );
    }

    expect(mgr.size).toBe(3);
    mgr.cancelAll('shutdown');

    for (const p of promises) {
      await expect(p).rejects.toThrowError('shutdown');
    }
    expect(mgr.size).toBe(0);
  });
});

// ── isPathSafe ──

describe('isPathSafe', () => {
  it('allows valid absolute path', () => {
    const result = isPathSafe('/home/user/file.txt');
    expect(result).toBe('/home/user/file.txt');
  });

  it('allows valid relative path', () => {
    const result = isPathSafe('src/file.ts');
    expect(result).toMatch(/\/src\/file\.ts$/);
  });

  it('blocks path traversal with ..', () => {
    expect(() => isPathSafe('../../../etc/passwd')).toThrowError(/Path traversal/);
  });

  it('blocks path traversal embedded in path', () => {
    expect(() => isPathSafe('/home/user/../../../etc/shadow')).toThrowError(/Path traversal/);
  });

  it('allows path within allowed directories', () => {
    const result = isPathSafe('/allowed/dir/file.txt', ['/allowed/dir']);
    expect(result).toBe('/allowed/dir/file.txt');
  });

  it('blocks path outside allowed directories', () => {
    expect(() => isPathSafe('/other/dir/file.txt', ['/allowed/dir'])).toThrowError(
      /outside allowed directories/,
    );
  });

  it('allows any path when no allowedDirs specified', () => {
    const result = isPathSafe('/any/path/file.txt');
    expect(result).toBe('/any/path/file.txt');
  });
});
