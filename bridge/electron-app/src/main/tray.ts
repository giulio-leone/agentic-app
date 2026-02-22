import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BridgeManager, BridgeStatus } from './bridge-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATUS_LABELS: Record<BridgeStatus, string> = {
  stopped: '⏹ Bridge Stopped',
  starting: '🔄 Starting...',
  running: '✅ Bridge Running',
  error: '❌ Bridge Error',
};

export function createTray(
  bridgeManager: BridgeManager,
  mainWindow: BrowserWindow,
): Tray {
  // Use a simple template image (16x16)
  const iconPath = resolve(__dirname, '../../../resources/tray-icon.png');
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    // Fallback: create empty icon
    icon = nativeImage.createEmpty();
  }

  const tray = new Tray(icon);
  tray.setToolTip('Agentic Bridge');

  const updateMenu = () => {
    const isRunning = bridgeManager.status === 'running';
    const contextMenu = Menu.buildFromTemplate([
      { label: STATUS_LABELS[bridgeManager.status], enabled: false },
      { type: 'separator' },
      {
        label: 'Start Bridge',
        enabled: !isRunning && bridgeManager.status !== 'starting',
        click: () => {
          mainWindow.webContents.send('bridge:action', 'start');
        },
      },
      {
        label: 'Stop Bridge',
        enabled: isRunning,
        click: () => {
          mainWindow.webContents.send('bridge:action', 'stop');
        },
      },
      {
        label: 'Restart Bridge',
        enabled: isRunning,
        click: () => {
          mainWindow.webContents.send('bridge:action', 'restart');
        },
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip(`Agentic Bridge — ${STATUS_LABELS[bridgeManager.status]}`);
  };

  bridgeManager.on('status', updateMenu);
  updateMenu();

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  return tray;
}
