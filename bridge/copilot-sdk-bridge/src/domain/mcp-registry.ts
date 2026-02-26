/**
 * MCP Registry — manages Model Context Protocol server configurations.
 *
 * Configs are loaded from `~/.copilot/mcp-config.json` and passed to
 * the `@github/copilot-sdk` when creating sessions so the LLM can
 * invoke external tools.
 *
 * File format mirrors the Telegram bot's MCP config.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { SecurityError } from '../errors.js';

// ── Constants ──

/** Default config path: `~/.copilot/mcp-config.json`. */
const DEFAULT_CONFIG_PATH = join(homedir(), '.copilot', 'mcp-config.json');

/** Executables allowed in MCP server commands. */
const ALLOWED_EXECUTABLES = new Set([
  'node', 'npx', 'npm',
  'python', 'python3', 'pip', 'pip3',
  'deno', 'bun', 'bunx',
  'docker', 'podman',
  'uvx', 'uv',
]);

// ── Types ──

/** Internal representation of a single MCP server entry. */
export interface McpServerConfig {
  /** Derived from the JSON key name. */
  id: string;
  /** Same as `id`. */
  name: string;
  /** Executable to spawn. */
  command: string;
  /** CLI arguments passed to the command. */
  args?: string[];
  /** Environment variables injected into the process. */
  env?: Record<string, string>;
  /** Whether the server is enabled (inverse of `disabled` in the file). */
  enabled: boolean;
}

/** Format expected by the Copilot SDK's `createSession` `mcpServers` option. */
export interface SdkMcpServerEntry {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Shape of the on-disk JSON config file. */
interface McpConfigFile {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
  }>;
}

// ── Registry ──

/**
 * Manages MCP server configurations persisted in a JSON file.
 *
 * Usage:
 * ```ts
 * const registry = new McpRegistry();
 * await registry.loadConfig();
 * const servers = registry.getEnabledServers(); // → SdkMcpServerEntry[]
 * ```
 */
export class McpRegistry {
  private readonly configPath: string;
  private servers = new Map<string, McpServerConfig>();

  /** @param configPath — override the default `~/.copilot/mcp-config.json`. */
  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_CONFIG_PATH;
  }

  // ── Public API ──

  /**
   * Read and parse the JSON config file.
   * Missing file is treated as an empty registry (no error).
   */
  async loadConfig(): Promise<void> {
    this.servers.clear();

    let raw: string;
    try {
      raw = await readFile(this.configPath, 'utf-8');
    } catch {
      console.log('[mcp] No config file at %s — starting with empty registry', this.configPath);
      return;
    }

    let file: McpConfigFile;
    try {
      file = JSON.parse(raw) as McpConfigFile;
    } catch {
      console.warn('[mcp] Failed to parse %s — starting with empty registry', this.configPath);
      return;
    }

    const entries = file.mcpServers ?? {};
    for (const [key, value] of Object.entries(entries)) {
      this.servers.set(key, {
        id: key,
        name: key,
        command: value.command,
        args: value.args,
        env: value.env,
        enabled: !value.disabled,
      });
    }

    console.log('[mcp] Loaded %d server(s) from %s', this.servers.size, this.configPath);
  }

  /** Return every registered server config. */
  listServers(): McpServerConfig[] {
    return [...this.servers.values()];
  }

  /**
   * Return only enabled servers in the format the Copilot SDK expects.
   */
  getEnabledServers(): SdkMcpServerEntry[] {
    return this.listServers()
      .filter((s) => s.enabled)
      .map(({ name, command, args, env }) => {
        const entry: SdkMcpServerEntry = { name, command };
        if (args?.length) entry.args = args;
        if (env && Object.keys(env).length) entry.env = env;
        return entry;
      });
  }

  /**
   * Toggle a server's enabled / disabled state and persist the change.
   *
   * @throws {Error} If `serverId` is not in the registry.
   */
  async toggleServer(serverId: string, enabled: boolean): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`[mcp] Unknown server: ${serverId}`);
    }
    server.enabled = enabled;
    console.log('[mcp] Server "%s" %s', serverId, enabled ? 'enabled' : 'disabled');
    await this.saveConfig();
  }

  /**
   * Add a new MCP server entry and persist the change.
   *
   * @throws {SecurityError} If `command` is not in the allowed executables whitelist.
   */
  async addServer(
    name: string,
    command: string,
    args?: string[],
    env?: Record<string, string>,
  ): Promise<void> {
    if (!ALLOWED_EXECUTABLES.has(command)) {
      throw new SecurityError(
        `[mcp] Command "${command}" is not allowed. Permitted: ${[...ALLOWED_EXECUTABLES].join(', ')}`,
      );
    }

    const config: McpServerConfig = {
      id: name,
      name,
      command,
      args,
      env,
      enabled: true,
    };

    this.servers.set(name, config);
    console.log('[mcp] Added server "%s" (%s)', name, command);
    await this.saveConfig();
  }

  /**
   * Remove a server entry and persist the change.
   *
   * @throws {Error} If `serverId` is not in the registry.
   */
  async removeServer(serverId: string): Promise<void> {
    if (!this.servers.has(serverId)) {
      throw new Error(`[mcp] Unknown server: ${serverId}`);
    }
    this.servers.delete(serverId);
    console.log('[mcp] Removed server "%s"', serverId);
    await this.saveConfig();
  }

  // ── Private ──

  /** Serialize the registry back to the JSON config file, creating dirs if needed. */
  private async saveConfig(): Promise<void> {
    const mcpServers: McpConfigFile['mcpServers'] = {};

    for (const [key, s] of this.servers) {
      const entry: McpConfigFile['mcpServers'][string] = { command: s.command };
      if (s.args?.length) entry.args = s.args;
      if (s.env && Object.keys(s.env).length) entry.env = s.env;
      if (!s.enabled) entry.disabled = true;
      mcpServers[key] = entry;
    }

    const json = JSON.stringify({ mcpServers } satisfies McpConfigFile, null, 2) + '\n';

    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, json, 'utf-8');
    console.log('[mcp] Config saved to %s', this.configPath);
  }
}
