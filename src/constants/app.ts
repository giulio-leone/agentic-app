/**
 * App-wide constants. Change these to rebrand or configure the app.
 */

export const APP_NAME = 'Agentic';
export const APP_DISPLAY_NAME = 'Agentic';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Cross-platform agent chat client — ACP protocol';

// ACP client identification sent during initialize handshake
export const ACP_CLIENT_NAME = 'Agentic';
export const ACP_CLIENT_VERSION = APP_VERSION;

// Defaults
export const DEFAULT_PROTOCOL = 'ws';
export const DEFAULT_PORT = '8765';
export const DEFAULT_CWD = '/tmp';

// Limits
export const MAX_LOG_ENTRIES = 500;
export const MESSAGE_PREVIEW_LENGTH = 50;
