import { app } from 'electron';

/** Toggle auto-launch on system login (Mac/Linux/Windows). */
export function setAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });
}

export function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
