import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpRegistry } from './mcp-registry.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('McpRegistry', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
    configPath = path.join(tmpDir, 'mcp-config.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const sampleConfig = {
    mcpServers: {
      'my-server': { command: 'node', args: ['server.js'], env: { PORT: '3000' } },
      'disabled-server': { command: 'npx', args: ['tool'], disabled: true },
    },
  };

  async function writeConfig(data: unknown) {
    await fs.writeFile(configPath, JSON.stringify(data), 'utf-8');
  }

  // ── loadConfig ──

  it('loads config from file', async () => {
    await writeConfig(sampleConfig);
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();

    const servers = registry.listServers();
    expect(servers).toHaveLength(2);
    expect(servers.find((s) => s.id === 'my-server')?.enabled).toBe(true);
    expect(servers.find((s) => s.id === 'disabled-server')?.enabled).toBe(false);
  });

  it('handles missing config file gracefully', async () => {
    const registry = new McpRegistry(path.join(tmpDir, 'nonexistent.json'));
    await registry.loadConfig();
    expect(registry.listServers()).toEqual([]);
  });

  it('handles malformed JSON gracefully', async () => {
    await fs.writeFile(configPath, 'not json!!', 'utf-8');
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();
    expect(registry.listServers()).toEqual([]);
  });

  // ── listServers ──

  it('listServers returns all servers', async () => {
    await writeConfig(sampleConfig);
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();
    expect(registry.listServers()).toHaveLength(2);
  });

  // ── getEnabledServers ──

  it('getEnabledServers filters disabled servers', async () => {
    await writeConfig(sampleConfig);
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();

    const enabled = registry.getEnabledServers();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].name).toBe('my-server');
    expect(enabled[0].command).toBe('node');
    expect(enabled[0].args).toEqual(['server.js']);
    expect(enabled[0].env).toEqual({ PORT: '3000' });
  });

  // ── toggleServer ──

  it('toggleServer changes enabled state and persists', async () => {
    await writeConfig(sampleConfig);
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();

    await registry.toggleServer('disabled-server', true);
    expect(registry.getEnabledServers()).toHaveLength(2);

    // Verify persisted
    const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(raw.mcpServers['disabled-server'].disabled).toBeUndefined();
  });

  it('toggleServer throws for unknown server', async () => {
    const registry = new McpRegistry(configPath);
    await expect(registry.toggleServer('ghost', true)).rejects.toThrowError(/Unknown server/);
  });

  // ── addServer ──

  it('addServer adds valid command', async () => {
    const registry = new McpRegistry(configPath);
    await registry.addServer('test-srv', 'npx', ['run', 'test']);

    const servers = registry.listServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].command).toBe('npx');
    expect(servers[0].enabled).toBe(true);
  });

  it('addServer throws SecurityError for disallowed command', async () => {
    const registry = new McpRegistry(configPath);
    await expect(
      registry.addServer('evil', 'rm', ['-rf', '/']),
    ).rejects.toThrowError(/not allowed/);
  });

  it('addServer persists to disk', async () => {
    const registry = new McpRegistry(configPath);
    await registry.addServer('persisted', 'node', ['app.js']);

    const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(raw.mcpServers['persisted'].command).toBe('node');
  });

  // ── removeServer ──

  it('removeServer removes existing server', async () => {
    await writeConfig(sampleConfig);
    const registry = new McpRegistry(configPath);
    await registry.loadConfig();

    await registry.removeServer('my-server');
    expect(registry.listServers()).toHaveLength(1);
  });

  it('removeServer throws for unknown server', async () => {
    const registry = new McpRegistry(configPath);
    await expect(registry.removeServer('ghost')).rejects.toThrowError(/Unknown server/);
  });
});
