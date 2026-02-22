import { ipcMain, IpcMainInvokeEvent, dialog, Notification, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { BridgeManager, BridgeConfig, DEFAULT_CONFIG } from './bridge-manager.js';

const store = new Store<{ config: BridgeConfig; autoLaunch: boolean }>({
  defaults: { config: DEFAULT_CONFIG, autoLaunch: false },
});

export function setupIPC(bridgeManager: BridgeManager): void {
  ipcMain.handle('bridge:getConfig', () => store.get('config'));

  ipcMain.handle('bridge:setConfig', (_e: IpcMainInvokeEvent, config: BridgeConfig) => {
    store.set('config', config);
    return true;
  });

  ipcMain.handle('bridge:start', () => {
    const config = store.get('config');
    bridgeManager.start(config);
    return true;
  });

  ipcMain.handle('bridge:stop', () => {
    bridgeManager.stop();
    return true;
  });

  ipcMain.handle('bridge:restart', () => {
    const config = store.get('config');
    bridgeManager.restart(config);
    return true;
  });

  ipcMain.handle('bridge:getStatus', () => bridgeManager.status);

  ipcMain.handle('bridge:getLogs', () => [...bridgeManager.logs]);

  ipcMain.handle('bridge:clearLogs', () => {
    bridgeManager.clearLogs();
    return true;
  });

  ipcMain.handle('bridge:getClients', () => bridgeManager.clients);

  ipcMain.handle('app:getAutoLaunch', () => store.get('autoLaunch'));

  ipcMain.handle('app:setAutoLaunch', (_e: IpcMainInvokeEvent, enabled: boolean) => {
    store.set('autoLaunch', enabled);
    return true;
  });

  // Native directory picker
  ipcMain.handle('dialog:pickDirectory', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Desktop notifications on bridge status change
  bridgeManager.on('status', (status: string) => {
    if (!Notification.isSupported()) return;
    const messages: Record<string, { title: string; body: string } | undefined> = {
      running: { title: 'Agentic Bridge', body: '✅ Bridge is running' },
      error: { title: 'Agentic Bridge', body: '❌ Bridge encountered an error' },
      stopped: { title: 'Agentic Bridge', body: '⏹ Bridge stopped' },
    };
    const msg = messages[status];
    if (msg) new Notification(msg).show();
  });
}
