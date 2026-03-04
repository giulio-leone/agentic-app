/**
 * Network Manager — auto-discover and configure Tailscale + NordVPN Meshnet.
 *
 * Detects available networking options and configures the bridge endpoint
 * for remote access from the mobile app.
 */

import { execSync } from 'child_process';
import { networkInterfaces } from 'os';
import type { NetworkInfo } from '../protocol/messages.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('network');

export class NetworkManager {
  private info: NetworkInfo;

  constructor(private port: number) {
    this.info = {
      local: {
        ip: this.getLocalIp(),
        port,
      },
    };
  }

  /** Discover all available networking options */
  async discover(): Promise<NetworkInfo> {
    const [tailscale, meshnet] = await Promise.all([
      this.discoverTailscale(),
      this.discoverMeshnet(),
    ]);

    this.info.tailscale = tailscale;
    this.info.meshnet = meshnet;

    log.info('Network discovery complete', {
      tailscale: tailscale?.enabled ?? false,
      meshnet: meshnet?.enabled ?? false,
      localIp: this.info.local.ip,
    });

    return this.info;
  }

  /** Get current network info */
  getInfo(): NetworkInfo {
    return this.info;
  }

  /** Auto-publish via Tailscale serve */
  async publishTailscale(funnel = false): Promise<string | null> {
    if (!this.info.tailscale?.enabled) return null;

    try {
      const cmd = funnel ? 'funnel' : 'serve';
      execSync(
        `tailscale ${cmd} --bg --yes --https=443 http://127.0.0.1:${this.port}`,
        { stdio: 'pipe', timeout: 15000 },
      );
      const url = `https://${this.info.tailscale.dnsName}`;
      this.info.tailscale.url = url;
      this.info.tailscale.funnel = funnel;
      log.info(`Published via Tailscale ${cmd}`, { url });
      return url;
    } catch (err) {
      log.warn(`Tailscale publish failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Unpublish from Tailscale */
  unpublishTailscale(): void {
    try {
      execSync('tailscale serve --https=443 off', { stdio: 'pipe', timeout: 5000 });
      log.info('Unpublished from Tailscale');
    } catch { /* best effort */ }
  }

  /** Get the best URL for mobile connection */
  getBestUrl(): string {
    if (this.info.tailscale?.url) return this.info.tailscale.url;
    if (this.info.meshnet?.ip) return `ws://${this.info.meshnet.ip}:${this.port}`;
    if (this.info.tailscale?.ip) return `ws://${this.info.tailscale.ip}:${this.port}`;
    return `ws://${this.info.local.ip}:${this.port}`;
  }

  // ── Private ──

  private async discoverTailscale(): Promise<NetworkInfo['tailscale']> {
    try {
      const status = execSync('tailscale status --json 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parsed = JSON.parse(status);
      const self = parsed.Self;
      if (!self) return { enabled: false };

      const ip = self.TailscaleIPs?.[0] ?? '';
      const dnsName = (self.DNSName ?? '').replace(/\.$/, '');

      log.info('Tailscale detected', { ip, dnsName });
      return { enabled: true, ip, dnsName };
    } catch {
      return { enabled: false };
    }
  }

  private async discoverMeshnet(): Promise<NetworkInfo['meshnet']> {
    try {
      // Check if nordvpn meshnet is enabled
      const output = execSync('nordvpn meshnet peer list 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });

      // Get this machine's meshnet hostname and IP
      const statusOutput = execSync('nordvpn settings 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });

      // Try to get meshnet IP from interface
      const meshIp = this.getMeshnetIp();
      const hostname = this.getMeshnetHostname();

      if (meshIp || hostname) {
        log.info('NordVPN Meshnet detected', { ip: meshIp, hostname });
        return { enabled: true, ip: meshIp, hostname };
      }

      return { enabled: true };
    } catch {
      return { enabled: false };
    }
  }

  private getMeshnetIp(): string | undefined {
    // Meshnet uses a nordlynx or wg interface
    const ifaces = networkInterfaces();
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.includes('nordlynx') || name.includes('nordtun') || name.includes('wg')) {
        const v4 = addrs?.find(a => a.family === 'IPv4' && !a.internal);
        if (v4) return v4.address;
      }
    }
    return undefined;
  }

  private getMeshnetHostname(): string | undefined {
    try {
      const output = execSync('nordvpn meshnet peer list --filter=self 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      // Parse hostname from output
      const match = output.match(/Hostname:\s*(.+)/i);
      return match?.[1]?.trim();
    } catch {
      return undefined;
    }
  }

  private getLocalIp(): string {
    const ifaces = networkInterfaces();
    for (const addrs of Object.values(ifaces)) {
      const v4 = addrs?.find(a => a.family === 'IPv4' && !a.internal);
      if (v4) return v4.address;
    }
    return '127.0.0.1';
  }
}
