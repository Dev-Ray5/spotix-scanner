/**
 * Spotix Scanner — Professional Event Check-in System
 * Copyright © 2026 Spotix Technologies. All rights reserved.
 *
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without the express written
 * permission of Spotix Technologies.
 *
 * For licensing inquiries, contact: legal@spotix.com.ng
 */


import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';

export function checkForUpdates(mainWindow: BrowserWindow | null): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: v${info.version}`);

    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Spotix Scanner v${info.version} is available.`,
        detail: 'Download and install the update? It will be applied on next launch.',
        buttons: ['Update Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
          mainWindow?.webContents.send('update:downloading');
        }
      });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    mainWindow?.webContents.send('update:progress', percent);
    console.log(`[Updater] Download progress: ${percent}%`);
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] Update downloaded, will install on quit');
    mainWindow?.webContents.send('update:ready');

    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully.',
        detail: 'Restart Spotix Scanner now to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
  });

  // Check for updates silently
  autoUpdater.checkForUpdates().catch((err) => {
    console.log('[Updater] Could not check for updates:', err.message);
  });
}
