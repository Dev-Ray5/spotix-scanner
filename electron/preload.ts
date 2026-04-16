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

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spotix', {
  // Guest management
  importGuests: (filePath: string) =>
    ipcRenderer.invoke('guests:import', filePath),
  openGuestFileDialog: () =>
    ipcRenderer.invoke('dialog:openGuestFile'),

  // Logs
  exportLogs: (format: 'csv' | 'json' | 'both') =>
    ipcRenderer.invoke('logs:export', format),
  importLogs: () =>
    ipcRenderer.invoke('logs:import'),

  // Event lifecycle
  endEvent: (exportFormat: 'csv' | 'json' | 'both') =>
    ipcRenderer.invoke('event:end', exportFormat),

  // Shell
  openPath: (filePath: string) =>
    ipcRenderer.invoke('shell:openPath', filePath),

  // Resources
  openResource: (resource: 'terms' | 'guide') =>
    ipcRenderer.invoke('resources:open', resource),

  // Network
  getLocalIP: () =>
    ipcRenderer.invoke('network:getLocalIP'),
  getScannerUrl: () =>
    ipcRenderer.invoke('network:getScannerUrl'),

  // Menu event listeners (menu → React)
  onMenuAction: (callback: (action: string) => void) => {
    const handlers: Record<string, (...args: unknown[]) => void> = {
      'menu:import-guests': () => callback('import-guests'),
      'menu:export-logs':   () => callback('export-logs'),
      'menu:import-logs':   () => callback('import-logs'),
      'menu:end-event':     () => callback('end-event'),
    };

    for (const [channel, handler] of Object.entries(handlers)) {
      ipcRenderer.on(channel, handler);
    }

    return () => {
      for (const [channel, handler] of Object.entries(handlers)) {
        ipcRenderer.removeListener(channel, handler);
      }
    };
  },

  // Navigation from menu
  onNavigate: (callback: (path: string) => void) => {
    const handler = (_: unknown, path: string) => callback(path);
    ipcRenderer.on('menu:navigate', handler);
    return () => { ipcRenderer.removeListener('menu:navigate', handler); };
  },
});