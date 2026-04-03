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

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';

// Must be called before app is ready
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { createServer } from '../server/fastify';
import { buildAppMenu } from './menu';
import { checkForUpdates } from './updater';
import { setupPocketBase } from './pocketbase-setup';

// ─── Constants ────────────────────────────────────────────────────────────────

const POCKETBASE_PORT = 8090;
const FASTIFY_PORT = 3000;      // HTTPS — for scanner devices over WiFi
const FASTIFY_HTTP_PORT = 3001; // HTTP  — for Electron window
const IS_DEV = !app.isPackaged;

const IS_WIN = process.platform === 'win32';

const USER_DATA = app.getPath('userData');
const PB_DATA_DIR = path.join(USER_DATA, 'pb_data');
const CERT_DIR = path.join(USER_DATA, 'certs');

const NEXT_OUT_DIR = IS_DEV
  ? path.join(__dirname, '../../nextjs-app/out')
  : path.join(process.resourcesPath, 'app', 'nextjs-app', 'out');

const PB_BINARY = IS_DEV
  ? path.join(__dirname, '../../electron/pocketbase-win', IS_WIN ? 'pocketbase.exe' : 'pocketbase')
  : path.join(process.resourcesPath, 'pocketbase', IS_WIN ? 'pocketbase.exe' : 'pocketbase');

// Ensure static dir exists to prevent server from crashing
if (!fs.existsSync(NEXT_OUT_DIR)) {
  fs.mkdirSync(NEXT_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(NEXT_OUT_DIR, 'index.html'),
    '<html><body><p>Run npm run build:UI first</p></body></html>');
}

// ─── Network helpers ──────────────────────────────────────────────────────────

function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface ?? []) {
      if (config.family === 'IPv4' && !config.internal) {
        ips.push(config.address);
      }
    }
  }
  return ips;
}

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let pbProcess: ChildProcess | null = null;
let fastifyServer: { start: () => Promise<string>; stop: () => Promise<void> } | null = null;

// ─── PocketBase ───────────────────────────────────────────────────────────────

async function startPocketBase(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[DB] IS_DEV=${IS_DEV}, IS_WIN=${IS_WIN}`);
    console.log(`[DB] Looking for binary at: ${PB_BINARY}`);

    if (!fs.existsSync(PB_BINARY)) {
      console.error(`[DB] Binary not found at ${PB_BINARY}`);
      reject(new Error('PocketBase binary not found'));
      return;
    }

    pbProcess = spawn(PB_BINARY, [
      'serve',
      `--http=127.0.0.1:${POCKETBASE_PORT}`,
      `--dir=${PB_DATA_DIR}`,
    ]);

    pbProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[DB] ${data.toString().trim()}`);
    });

    pbProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[DB] ${data.toString().trim()}`);
    });

    pbProcess.on('exit', (code) => {
      console.log(`[DB] Killed with code ${code}`);
    });

    // Wait for db to be ready
    const checkReady = async (retries: number): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch('http://127.0.0.1:8090/api/health');
          if (res.ok) return true;
        } catch { /* not ready yet */ }
        await new Promise(r => setTimeout(r, 500));
      }
      return false;
    };

    checkReady(30).then((ready) => {
      if (ready) {
        console.log('[DB] All set');
        resolve();
      } else {
        reject(new Error('PocketBase failed to start'));
      }
    });
  });
}

const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@spotix.local';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'Sp0tix@Scanner2024!';

async function ensurePocketBaseSchema(): Promise<void> {
  await setupPocketBase(USER_DATA, PB_BINARY, PB_DATA_DIR, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
}

function stopPocketBase(): void {
  if (pbProcess) {
    pbProcess.kill();
    pbProcess = null;
    console.log('[DB] Stopped');
  }
}

async function purgeDatabase(): Promise<void> {
  if (pbProcess) {
    pbProcess.kill();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      pbProcess?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    pbProcess = null;
  }

  await new Promise(r => setTimeout(r, 500));

  const dbFile    = path.join(PB_DATA_DIR, 'data.db');
  const dbWalFile = path.join(PB_DATA_DIR, 'data.db-wal');
  const dbShmFile = path.join(PB_DATA_DIR, 'data.db-shm');

  try {
    if (fs.existsSync(dbFile))    fs.rmSync(dbFile,    { force: true });
    if (fs.existsSync(dbWalFile)) fs.rmSync(dbWalFile, { force: true });
    if (fs.existsSync(dbShmFile)) fs.rmSync(dbShmFile, { force: true });
    console.log('[DB] Database purged');
  } catch (err) {
    console.error('[DB] Failed to delete database files:', err);
    throw err;
  }

  await startPocketBase();
  await ensurePocketBaseSchema();
  console.log('[DB] Fresh database ready');
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  const { session } = require('electron');

  const trustedLocalIPs = new Set(['localhost', '127.0.0.1', ...getLocalIPs()]);

  session.defaultSession.setCertificateVerifyProc(
    (request: { hostname: string }, callback: (result: number) => void) => {
      if (trustedLocalIPs.has(request.hostname)) {
        callback(0);
      } else {
        callback(-3);
      }
    }
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    title: 'Spotix Scanner',
    show: false,
  });

  const dashboardUrl = `http://localhost:${FASTIFY_HTTP_PORT}/dashboard`;
  mainWindow.loadURL(dashboardUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

let ipcHandlersRegistered = false;
function registerIpcHandlers(): void {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  ipcMain.handle('guests:import', async (_event, filePath: string) => {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const guests = JSON.parse(raw);
      const response = await fetch(`http://localhost:${FASTIFY_HTTP_PORT}/api/guests/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests }),
      });
      return response.json();
    } catch (err) {
      return { error: String(err) };
    }
  });

  ipcMain.handle('dialog:openGuestFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Guest List',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    return result.filePaths[0] ?? null;
  });

  const exportLogsHandler = async (format: 'csv' | 'json' | 'both'): Promise<{ success: boolean; paths?: string[]; error?: string }> => {
    try {
      const pbEmail    = process.env.PB_ADMIN_EMAIL    || 'admin@spotix.local';
      const pbPassword = process.env.PB_ADMIN_PASSWORD || 'Sp0tix@Scanner2024!';

      let pbToken = '';
      for (const ep of ['/api/collections/_superusers/auth-with-password', '/api/admins/auth-with-password']) {
        try {
          const authRes = await fetch(`http://127.0.0.1:8090${ep}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: pbEmail, password: pbPassword }),
          });
          if (authRes.ok) {
            const authData = await authRes.json() as { token: string };
            pbToken = authData.token;
            break;
          }
        } catch { /* try next */ }
      }

      const logsRes  = await fetch('http://127.0.0.1:8090/api/collections/logs/records?perPage=500&sort=%2Btimestamp', {
        headers: { Authorization: pbToken },
      });
      const logsData = await logsRes.json() as { items: any[] };
      const logs     = logsData.items ?? [];

      const guestsRes  = await fetch('http://127.0.0.1:8090/api/collections/guests/records?perPage=1', {
        headers: { Authorization: pbToken },
      });
      const guestsData = await guestsRes.json() as { totalItems: number };
      const totalGuests = guestsData.totalItems ?? 0;
      const checkedIn   = logs.filter((l: any) => l.result === 'success').length;

      const summary = {
        exportedAt:    new Date().toISOString(),
        totalGuests,
        checkedIn,
        noShows:       totalGuests - checkedIn,
        invalidScans:  logs.filter((l: any) => l.result === 'invalid').length,
        alreadyScanned: logs.filter((l: any) => l.result === 'already_scanned').length,
        logs,
      };

      const downloadsDir = app.getPath('downloads');
      const timestamp    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const savedPaths: string[] = [];

      if (format === 'json' || format === 'both') {
        const jsonPath = path.join(downloadsDir, `spotix-logs-${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
        savedPaths.push(jsonPath);
      }

      if (format === 'csv' || format === 'both') {
        const csvPath = path.join(downloadsDir, `spotix-logs-${timestamp}.csv`);
        const headers = 'ticketId,guestName,scannerId,result,checkedInDate,checkedInTime,timestamp,note';
        const rows    = logs.map((l: any) =>
          `${l.ticketId},"${l.guestName}",${l.scannerId},${l.result},${l.checkedInDate},${l.checkedInTime},${l.timestamp},"${l.note ?? ''}"`
        );
        fs.writeFileSync(csvPath, [headers, ...rows].join('\n'));
        savedPaths.push(csvPath);
      }

      return { success: true, paths: savedPaths };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  };

  ipcMain.handle('logs:export', async (_event, format: 'csv' | 'json' | 'both') => {
    return exportLogsHandler(format);
  });

  ipcMain.handle('event:end', async (_event, exportFormat: 'csv' | 'json' | 'both') => {
    try {
      const exportResult = await exportLogsHandler(exportFormat);
      if (!exportResult.success) {
        console.error('[IPC] Log export failed before end event:', exportResult.error);
      }
      await fetch(`http://localhost:${FASTIFY_HTTP_PORT}/api/event/end`, { method: 'POST' });
      await purgeDatabase();
      return { success: true, paths: exportResult.paths ?? [] };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('logs:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Event Logs',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    const filePath = result.filePaths[0];
    if (!filePath) return { cancelled: true };
    try {
      const raw  = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const logs = Array.isArray(data) ? data : (data.logs ?? []);
      return { success: true, logs, filePath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
    await shell.showItemInFolder(filePath);
  });

  ipcMain.handle('resources:open', async (_event, resource: 'terms' | 'guide') => {
    const resourcePath = IS_DEV
      ? path.join(__dirname, '../../resources', `${resource === 'terms' ? 'terms' : 'operation-guide'}.pdf`)
      : path.join(process.resourcesPath, `${resource === 'terms' ? 'terms' : 'operation-guide'}.pdf`);
    await shell.openPath(resourcePath);
  });

  ipcMain.handle('network:getLocalIP', () => {
    const ips = getLocalIPs();
    return ips[0] ?? 'localhost';
  });

  ipcMain.handle('network:getScannerUrl', () => {
    const ips = getLocalIPs();
    const ip  = ips[0] ?? 'localhost';
    return `https://${ip}:${FASTIFY_PORT}/scanner`;
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    console.log('[App] Starting Spotix Scanner...');

    await startPocketBase();
    await ensurePocketBaseSchema();

    fastifyServer = await createServer({
      certDir:   CERT_DIR,
      staticDir: NEXT_OUT_DIR,
      port:      FASTIFY_PORT,
      httpPort:  FASTIFY_HTTP_PORT,
    });
    await fastifyServer.start();

    registerIpcHandlers();
    createWindow();
    buildAppMenu(mainWindow);

    mainWindow?.webContents.on('did-finish-load', () => {
      // Re-register in case window reloads
    });

    if (!IS_DEV) {
      setTimeout(() => checkForUpdates(mainWindow), 5000);
    }

    console.log('[App] All set!');
  } catch (err) {
    console.error('[App] Startup failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  console.log('[App] Shutting down...');
  await fastifyServer?.stop();
  stopPocketBase();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});