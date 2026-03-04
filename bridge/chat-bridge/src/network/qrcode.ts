/**
 * QR Code generator — creates a QR code for mobile app pairing.
 */

import QRCode from 'qrcode';
import { Logger } from '../utils/logger.js';

const log = new Logger('qrcode');

/** Generate a terminal-printable QR code */
export async function printQRCode(url: string): Promise<void> {
  try {
    const qr = await QRCode.toString(url, { type: 'terminal', small: true });
    console.log('\n📱 Scan this QR code from the Agmente app:\n');
    console.log(qr);
    console.log(`   ${url}\n`);
  } catch (err) {
    log.warn('QR code generation failed', { error: (err as Error).message });
    console.log(`\n📱 Connect from the app: ${url}\n`);
  }
}

/** Generate QR code as SVG string (for HTTP endpoint) */
export async function generateQRSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg' });
}
