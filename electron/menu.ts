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



import { Menu, MenuItem, shell, BrowserWindow, dialog, ipcMain, app } from 'electron';

function showInfoDialog(title: string, body: string): void {
  dialog.showMessageBox({
    type: 'info',
    title,
    message: title,
    detail: body,
    buttons: ['Close'],
  });
}

function openExternal(url: string): void {
  shell.openExternal(url);
}

export function buildAppMenu(mainWindow: BrowserWindow | null): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [

    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // ── File ──────────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Guests',
          accelerator: 'CmdOrCtrl+I',
          click: () => { mainWindow?.webContents.send('menu:import-guests'); },
        },
        {
          label: 'Export Logs',
          accelerator: 'CmdOrCtrl+E',
          click: () => { mainWindow?.webContents.send('menu:export-logs'); },
        },
        {
          label: 'Import Logs',
          click: () => { mainWindow?.webContents.send('menu:import-logs'); },
        },
        { type: 'separator' as const },
        {
          label: 'End Event',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => { mainWindow?.webContents.send('menu:end-event'); },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // ── Navigate ──────────────────────────────────────────────────────────────
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Control Panel',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.send('menu:navigate', '/dashboard/');
          },
        },
        {
          label: 'Manage Registry',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.send('menu:navigate', '/manage/');
          },
        },
      ],
    },

    // ── View ──────────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // ── Window ────────────────────────────────────────────────────────────────
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },

    // ── About ─────────────────────────────────────────────────────────────────
    {
      label: 'About',
      submenu: [
        {
          label: 'About Spotix',
          click: () => {
            showInfoDialog(
              'About Spotix',
              'Spotix is Nigeria\'s leading live event ticketing and booking platform, built to serve event-goers and organizers across the country.\n\nWe make it seamless to discover events, purchase tickets, and manage attendance — all in one place.\n\nVisit us at spotix.com.ng'
            );
          },
        },
        {
          label: 'About Spotix Offline Tool',
          click: () => {
            showInfoDialog(
                'About Spotix Offline Tool',
                'The Spotix Scanner is a professional offline event check-in system designed for Nigerian event organizers.\n\nIt runs entirely on the organizer\'s laptop — no internet required at the event. Import your guest list, connect scanner devices over local WiFi, and check in attendees via QR code, email, ticket ID, or facial recognition.\n\nAll data stays local. Export your logs at the end of every event.\n\nVersion: ' + app.getVersion()
            );
          },
        },
        { type: 'separator' as const },
        {
          label: 'Developers',
          click: () => openExternal('https://spotix.com.ng/offline-tool/developers'),
        },
        {
          label: 'Get Involved',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Getting Involved',
              message: 'Getting Involved',
              detail: 'You can get involved with the Spotix Offline Tool in several ways:\n\n• Support us financially to help us build better tools for Nigerian event organizers\n• Submit pull requests on our open source repository\n• Report bugs and suggest features\n• Spread the word to event organizers in your community\n\nVisit our website to learn more about how you can contribute.',
              buttons: ['Visit Website', 'Close'],
              defaultId: 0,
            }).then(({ response }) => {
              if (response === 0) openExternal('https://spotix.com.ng/offline-tool/get-involved');
            });
          },
        },
        {
          label: 'Older Releases',
          click: () => openExternal('https://spotix.com.ng/offline-tool/versions'),
        },
        { type: 'separator' as const },
        {
          label: 'Report a Bug',
          click: () => openExternal('https://spotix.com.ng/offline-tool/report-bug'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}