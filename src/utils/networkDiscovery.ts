/**
 * Network discovery — scan for ACP bridge servers on local/VPN networks.
 * Uses TCP socket probing to find active bridge endpoints.
 */

import TcpSocket from 'react-native-tcp-socket';

const DEFAULT_PORTS = [8765, 4500, 3000, 8080];
const PROBE_TIMEOUT_MS = 1500;

export interface DiscoveredHost {
  host: string;
  port: number;
  latencyMs: number;
}

/** Probe a single host:port via TCP connect. Resolves with latency or rejects. */
function probeHost(host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = TcpSocket.createConnection({ host, port }, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });
    socket.on('error', () => {
      socket.destroy();
      reject(new Error('unreachable'));
    });
    // Safety timeout
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('timeout'));
    }, PROBE_TIMEOUT_MS + 200);
    socket.on('close', () => clearTimeout(timer));
  });
}

/** Test connectivity to a specific host:port. Returns latency in ms or null. */
export async function pingHost(host: string, port: number): Promise<number | null> {
  try {
    return await probeHost(host, port);
  } catch { /* probe timeout/refused — host unreachable */
    return null;
  }
}

/**
 * Scan a subnet (e.g. "192.168.1") for bridge servers.
 * Probes IPs .1–.254 on given ports concurrently in batches.
 */
export async function scanSubnet(
  subnet: string,
  ports: number[] = DEFAULT_PORTS,
  onFound?: (host: DiscoveredHost) => void,
): Promise<DiscoveredHost[]> {
  const found: DiscoveredHost[] = [];
  const BATCH_SIZE = 20;

  for (let batch = 1; batch <= 254; batch += BATCH_SIZE) {
    const promises: Promise<void>[] = [];
    for (let i = batch; i < Math.min(batch + BATCH_SIZE, 255); i++) {
      const ip = `${subnet}.${i}`;
      for (const port of ports) {
        promises.push(
          probeHost(ip, port)
            .then(latency => {
              const host: DiscoveredHost = { host: ip, port, latencyMs: latency };
              found.push(host);
              onFound?.(host);
            })
            .catch(() => { /* probe timeout/refused — expected for inactive hosts */ }),
        );
      }
    }
    await Promise.all(promises);
  }

  return found.sort((a, b) => a.latencyMs - b.latencyMs);
}

/** Get common subnets to scan (192.168.x, 10.x, 100.64.x for Tailscale). */
export function getCommonSubnets(): string[] {
  return ['192.168.1', '192.168.0', '10.0.0', '100.64.0'];
}
