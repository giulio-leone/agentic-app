import { eventBus } from '../domain';
import { ACPGateway, ACPGatewayConfig } from '../application/services/ACPGateway';
import { SessionRouter } from '../application/services/SessionRouter';
import { MessageDeduplicator, messageDeduplicator } from '../application/services/MessageDeduplicator';
import {
  DiscoverCliSessions,
  LoadCliSessionTurns,
  SendPromptToCliSession,
  SpawnCliSession,
  KillCliSession,
  WatchCliSessions,
} from '../application/use-cases/CliUseCases';
import {
  InitializeConnection,
  CreateSession,
  LoadSession,
  ListSessions,
  SendPrompt,
  CancelPrompt,
  SetSessionMode,
  SpawnTerminal,
  SendTerminalInput,
  ResizeTerminal,
  CloseTerminal,
  ListTerminals,
  BrowseFilesystem,
} from '../application/use-cases/SessionUseCases';

export interface AcpHexConfig {
  endpoint: string;              // "ws://host:port" or "tcp://host:port"
  transportType: 'websocket' | 'tcp';
  tcpFallbackPort?: number;
  clientName?: string;
  clientVersion?: string;
}

export interface AcpHexInstance {
  // Gateway
  gateway: ACPGateway;

  // Session Router (unified sendPrompt/loadMessages for all session types)
  router: SessionRouter;

  // Use Cases
  cli: {
    discover: DiscoverCliSessions;
    loadTurns: LoadCliSessionTurns;
    sendPrompt: SendPromptToCliSession;
    spawn: SpawnCliSession;
    kill: KillCliSession;
    watch: WatchCliSessions;
  };

  session: {
    initialize: InitializeConnection;
    create: CreateSession;
    load: LoadSession;
    list: ListSessions;
    sendPrompt: SendPrompt;
    cancel: CancelPrompt;
    setMode: SetSessionMode;
  };

  terminal: {
    spawn: SpawnTerminal;
    input: SendTerminalInput;
    resize: ResizeTerminal;
    close: CloseTerminal;
    list: ListTerminals;
  };

  filesystem: {
    browse: BrowseFilesystem;
  };

  deduplicator: MessageDeduplicator;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): void;
  dispose(): void;
}

let instance: AcpHexInstance | null = null;

export function createAcpHex(config: AcpHexConfig): AcpHexInstance {
  if (instance) {
    instance.dispose();
  }

  // Create gateway
  const gateway = new ACPGateway({
    endpoint: config.endpoint,
    transportType: config.transportType,
    tcpFallbackPort: config.tcpFallbackPort,
  });

  // Create use cases (inject gateway)
  const cli = {
    discover: new DiscoverCliSessions(gateway),
    loadTurns: new LoadCliSessionTurns(gateway),
    sendPrompt: new SendPromptToCliSession(gateway),
    spawn: new SpawnCliSession(gateway),
    kill: new KillCliSession(gateway),
    watch: new WatchCliSessions(gateway),
  };

  const session = {
    initialize: new InitializeConnection(gateway),
    create: new CreateSession(gateway),
    load: new LoadSession(gateway),
    list: new ListSessions(gateway),
    sendPrompt: new SendPrompt(gateway),
    cancel: new CancelPrompt(gateway),
    setMode: new SetSessionMode(gateway),
  };

  const terminal = {
    spawn: new SpawnTerminal(gateway),
    input: new SendTerminalInput(gateway),
    resize: new ResizeTerminal(gateway),
    close: new CloseTerminal(gateway),
    list: new ListTerminals(gateway),
  };

  const filesystem = {
    browse: new BrowseFilesystem(gateway),
  };

  // Create session router
  const router = new SessionRouter();

  // Register handlers — THIS IS WHERE CLI BECOMES WRITABLE!
  router.registerSendPromptHandler('acp', {
    execute: (sessionId, prompt, attachments) =>
      session.sendPrompt.execute(sessionId, prompt, attachments),
  });
  router.registerSendPromptHandler('cli', {
    execute: (sessionId, prompt) => cli.sendPrompt.execute(sessionId, prompt),
  });

  router.registerLoadMessagesHandler('acp', {
    execute: async (sessionId) => {
      // ACP sessions load via session/load + notifications
      await session.load.execute(sessionId);
      return []; // Messages come via EventBus
    },
  });
  router.registerLoadMessagesHandler('cli', {
    execute: (sessionId) => cli.loadTurns.execute(sessionId),
  });

  const deduplicator = messageDeduplicator;

  instance = {
    gateway,
    router,
    cli,
    session,
    terminal,
    filesystem,
    deduplicator,

    async connect() {
      await gateway.connect();
      const clientName = config.clientName ?? 'AgmenteRN';
      const clientVersion = config.clientVersion ?? '3.15.0';
      await session.initialize.execute(clientName, clientVersion);
    },

    disconnect() {
      cli.watch.dispose();
      gateway.disconnect();
    },

    dispose() {
      cli.watch.dispose();
      gateway.dispose();
      deduplicator.reset();
      instance = null;
    },
  };

  return instance;
}

export function getAcpHex(): AcpHexInstance | null {
  return instance;
}
