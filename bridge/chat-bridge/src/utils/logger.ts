/**
 * Structured logger with ISO timestamps.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export class Logger {
  constructor(private scope: string) {}

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const prefix = `${color}[${ts}] [${level.toUpperCase()}] [${this.scope}]${RESET}`;
    if (data) {
      console.log(`${prefix} ${msg}`, JSON.stringify(data));
    } else {
      console.log(`${prefix} ${msg}`);
    }
  }
}
