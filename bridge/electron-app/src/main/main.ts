import { app, BrowserWindow } from 'electron';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BridgeManager } from './bridge-manager.js';
import { setupIPC } from './ipc-handlers.js';
import { createTray } from './tray.js';

app.commandLine.appendSwitch('remote-debugging-port', '9222');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;
const bridgeManager = new BridgeManager();

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 580,
    minWidth: 520,
    minHeight: 400,
    title: 'Agentic Bridge',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(join(__dirname, '../../renderer/index.html'));
  }

  // Forward bridge events to renderer
  bridgeManager.on('status', (status: string) => {
    win.webContents.send('bridge:status', status);
  });
  bridgeManager.on('log', (line: string) => {
    win.webContents.send('bridge:log', line);
  });

  win.on('close', (e) => {
    // Hide instead of close when bridge is running
    if (bridgeManager.status === 'running') {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}

app.whenReady().then(() => {
  setupIPC(bridgeManager);
  mainWindow = createWindow();
  createTray(bridgeManager, mainWindow);

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  bridgeManager.stop();
});
