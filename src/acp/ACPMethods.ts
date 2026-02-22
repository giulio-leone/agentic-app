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
} as const;
