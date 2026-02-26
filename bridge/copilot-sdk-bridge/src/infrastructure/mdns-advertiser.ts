/**
 * mDNS / Bonjour service advertiser.
 *
 * Publishes the Copilot SDK Bridge as a `_copilot-bridge._tcp` service
 * so React Native apps on the same local network can auto-discover it.
 *
 * @module
 */

import { Bonjour } from 'bonjour-service';
import type { Service } from 'bonjour-service';
import { hostname } from 'node:os';

// ── Types ──

/** Options required to create an {@link MdnsAdvertiser}. */
export interface MdnsAdvertiserOptions {
  /** WebSocket port the bridge is listening on. */
  port: number;
  /** Whether TLS is enabled. */
  tls: boolean;
  /** Human-readable service name (defaults to `copilot-bridge-<hostname>`). */
  bridgeName?: string;
}

/** Snapshot of the currently advertised service. */
export interface MdnsServiceInfo {
  name: string;
  type: string;
  port: number;
  host: string;
  txt: Record<string, string>;
}

// ── Constants ──

const SERVICE_TYPE = 'copilot-bridge';
const SERVICE_VERSION = '1.0.0';

// ── Implementation ──

/**
 * Advertise the bridge as a Bonjour / mDNS service so RN apps on the
 * same network can discover it automatically.
 */
export class MdnsAdvertiser {
  private readonly port: number;
  private readonly tls: boolean;
  private readonly serviceName: string;
  private bonjour: Bonjour | undefined;
  private service: Service | undefined;

  /** Create a new advertiser (does **not** start publishing yet). */
  constructor(opts: MdnsAdvertiserOptions) {
    this.port = opts.port;
    this.tls = opts.tls;
    this.serviceName = opts.bridgeName ?? `copilot-bridge-${hostname()}`;
  }

  // ── Public API ──

  /**
   * Publish the mDNS service.
   *
   * Calling `start()` more than once is a no-op.
   */
  start(): void {
    if (this.bonjour) return;

    this.bonjour = new Bonjour();
    this.service = this.bonjour.publish({
      name: this.serviceName,
      type: SERVICE_TYPE,
      port: this.port,
      txt: {
        version: SERVICE_VERSION,
        tls: String(this.tls),
        protocol: 'ws',
      },
    });

    console.log(
      `[mdns] Published _${SERVICE_TYPE}._tcp — "${this.serviceName}" on port ${this.port}`,
    );
  }

  /**
   * Unpublish the service and release all resources.
   */
  stop(): void {
    if (this.service) {
      this.service.stop?.();
      this.service = undefined;
    }
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = undefined;
    }
    console.log('[mdns] Service unpublished');
  }

  /**
   * Return a snapshot of the currently advertised service metadata.
   *
   * Returns `undefined` when the advertiser has not been started.
   */
  getServiceInfo(): MdnsServiceInfo | undefined {
    if (!this.service) return undefined;

    return {
      name: this.serviceName,
      type: `_${SERVICE_TYPE}._tcp`,
      port: this.port,
      host: hostname(),
      txt: {
        version: SERVICE_VERSION,
        tls: String(this.tls),
        protocol: 'ws',
      },
    };
  }
}
