export { createAcpHex, getAcpHex } from './bootstrap';
export type { AcpHexConfig, AcpHexInstance } from './bootstrap';

export { useAcpStore } from './useAcpStore';

export {
  useAcpConnection,
  useAcpChat,
  useCliSessions,
  useCliSessionsAutoWatch,
  useSendPrompt,
  useAcpTerminal,
  useConnectionStatus,
} from './hooks';
