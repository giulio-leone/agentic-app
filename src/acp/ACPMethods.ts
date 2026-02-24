/**
 * ACP RPC method constants – mirrors the Swift ACPMethods enum.
 */
export const ACPMethods = {
  initialize: 'initialize',
  sessionNew: 'session/new',
  sessionLoad: 'session/load',
  sessionResume: 'session/resume',
  sessionPrompt: 'session/prompt',
  sessionCancel: 'session/cancel',
  sessionList: 'session/list',
  sessionSetMode: 'session/set_mode',
  // Terminal
  terminalSpawn: 'terminal/spawn',
  terminalList: 'terminal/list',
  terminalConnectTmux: 'terminal/connect_tmux',
  terminalInput: 'terminal/input',
  terminalResize: 'terminal/resize',
  terminalClose: 'terminal/close',
  // Filesystem
  fsList: 'fs/list',
  // Copilot CLI session discovery
  copilotDiscover: 'copilot/discover',
  copilotTurns: 'copilot/sessions/turns',
  copilotWatchStart: 'copilot/watch/start',
  copilotWatchStop: 'copilot/watch/stop',
  // Copilot PTY interaction
  copilotSpawn: 'copilot/spawn',
  copilotWrite: 'copilot/write',
  copilotKill: 'copilot/kill',
  copilotPtyList: 'copilot/pty/list',
} as const;
