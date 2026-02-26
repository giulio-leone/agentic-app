import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from './session-manager.js';

function mockClient(sessionObj: unknown = { abort: vi.fn() }) {
  return { createSession: vi.fn().mockResolvedValue(sessionObj) };
}

describe('SessionManager', () => {
  let mgr: SessionManager;

  beforeEach(() => {
    mgr = new SessionManager(3);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ── Creation ──

  it('creates a session and returns sessionId + model', async () => {
    const client = mockClient();
    const result = await mgr.createSession({ client, model: 'gpt-4o' });

    expect(result.sessionId).toMatch(/^copilot-\d+-\d+$/);
    expect(result.model).toBe('gpt-4o');
    expect(client.createSession).toHaveBeenCalledOnce();
    expect(mgr.getSessionCount()).toBe(1);
  });

  it('uses default model and cwd when not specified', async () => {
    const client = mockClient();
    const result = await mgr.createSession({ client });

    expect(result.model).toBe('gpt-4o');
    expect(client.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', workingDirectory: process.cwd() }),
    );
  });

  // ── Retrieval ──

  it('getSession returns the stored entry', async () => {
    const session = { abort: vi.fn() };
    const client = mockClient(session);
    const { sessionId } = await mgr.createSession({ client, model: 'gpt-4' });

    const entry = mgr.getSession(sessionId);
    expect(entry.session).toBe(session);
    expect(entry.model).toBe('gpt-4');
  });

  it('getSession throws SessionError for unknown id', () => {
    expect(() => mgr.getSession('nonexistent')).toThrowError(/Session not found/);
  });

  // ── Touch ──

  it('touchSession updates lastActivity', async () => {
    const client = mockClient();
    const { sessionId } = await mgr.createSession({ client });
    const before = mgr.getSession(sessionId).lastActivity;

    // Small delay to ensure time difference
    await new Promise((r) => setTimeout(r, 10));
    mgr.touchSession(sessionId);

    const after = mgr.getSession(sessionId).lastActivity;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('touchSession throws for unknown session', () => {
    expect(() => mgr.touchSession('nonexistent')).toThrowError(/Session not found/);
  });

  // ── List sessions ──

  it('listSessions returns sorted by lastActivity desc', async () => {
    const client = mockClient();
    const s1 = await mgr.createSession({ client, model: 'a' });
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await mgr.createSession({ client, model: 'b' });
    await new Promise((r) => setTimeout(r, 10));
    const s3 = await mgr.createSession({ client, model: 'c' });

    const list = mgr.listSessions();
    expect(list).toHaveLength(3);
    // Most recent first
    expect(list[0].sessionId).toBe(s3.sessionId);
    expect(list[2].sessionId).toBe(s1.sessionId);
  });

  it('listSessions returns empty array when no sessions', () => {
    expect(mgr.listSessions()).toEqual([]);
  });

  // ── LRU eviction ──

  it('evicts LRU session when max reached', async () => {
    const client = mockClient();

    const s1 = await mgr.createSession({ client, model: 'a' });
    await new Promise((r) => setTimeout(r, 10));
    await mgr.createSession({ client, model: 'b' });
    await new Promise((r) => setTimeout(r, 10));
    await mgr.createSession({ client, model: 'c' });

    expect(mgr.getSessionCount()).toBe(3);

    // Creating a 4th session should evict s1 (oldest lastActivity)
    await mgr.createSession({ client, model: 'd' });
    expect(mgr.getSessionCount()).toBe(3);
    expect(() => mgr.getSession(s1.sessionId)).toThrowError(/Session not found/);
  });

  // ── Destruction ──

  it('destroySession removes and aborts the session', async () => {
    const session = { abort: vi.fn().mockResolvedValue(undefined) };
    const client = mockClient(session);
    const { sessionId } = await mgr.createSession({ client });

    await mgr.destroySession(sessionId);
    expect(session.abort).toHaveBeenCalledOnce();
    expect(mgr.getSessionCount()).toBe(0);
  });

  it('destroySession is no-op for unknown id', async () => {
    await expect(mgr.destroySession('nonexistent')).resolves.toBeUndefined();
  });

  it('destroySession handles abort failure gracefully', async () => {
    const session = { abort: vi.fn().mockRejectedValue(new Error('fail')) };
    const client = mockClient(session);
    const { sessionId } = await mgr.createSession({ client });

    await expect(mgr.destroySession(sessionId)).resolves.toBeUndefined();
    expect(mgr.getSessionCount()).toBe(0);
  });

  it('destroyAll cleans up all sessions', async () => {
    const client = mockClient();
    await mgr.createSession({ client });
    await mgr.createSession({ client });

    await mgr.destroyAll();
    expect(mgr.getSessionCount()).toBe(0);
  });

  // ── switchToProject ──

  it('switchToProject reuses existing session for same dir', async () => {
    const client = mockClient();
    const s1 = await mgr.createSession({ client, workingDirectory: '/proj/a' });

    const s2 = await mgr.switchToProject(client, '/proj/a');
    expect(s2.sessionId).toBe(s1.sessionId);
    expect(mgr.getSessionCount()).toBe(1);
  });

  it('switchToProject creates new session for different dir', async () => {
    const client = mockClient();
    const s1 = await mgr.createSession({ client, workingDirectory: '/proj/a' });

    const s2 = await mgr.switchToProject(client, '/proj/b');
    expect(mgr.getSessionCount()).toBe(2);
    expect(s2.sessionId).not.toBe(s1.sessionId);
  });
});
