import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import selfsigned from 'selfsigned';
import type { SocketStream } from '@fastify/websocket';
import type { ScanRequest, Scanner, WSMessage, Guest, Log } from './types';
import { cosineSimilarity, FACE_SIMILARITY_THRESHOLD, getCheckedInDate, getCheckedInTime } from './utils';

const POCKETBASE_URL = 'http://127.0.0.1:8090';
const PB_EMAIL    = process.env.PB_ADMIN_EMAIL    || 'admin@spotix.local';
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'Sp0tix@Scanner2024!';

// ─── PocketBase Auth ──────────────────────────────────────────────────────────

let _adminToken: string | null = null;
let _tokenExpiry: number = 0;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (_adminToken && now < _tokenExpiry) return _adminToken;

  const endpoints = [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${POCKETBASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text) as { token: string };
        _adminToken  = data.token;
        _tokenExpiry = now + 55 * 60 * 1000;
        console.log(`[Server] Database auth OK via ${endpoint}`);
        return _adminToken;
      }
    } catch (e) {
      console.error(`[Server] Auth ${endpoint} exception:`, e);
    }
  }
  throw new Error('[Server] Database authentication failed on all endpoints');
}

// ─── PocketBase REST helpers ──────────────────────────────────────────────────

async function pbGet(urlPath: string): Promise<Response> {
  const token   = await getToken();
  const fullUrl = `${POCKETBASE_URL}${urlPath}`;
  console.log(`[DB] GET ${fullUrl}`);
  return fetch(fullUrl, { headers: { Authorization: token } });
}

async function pbPost(pbPath: string, body: unknown): Promise<Response> {
  const token = await getToken();
  return fetch(`${POCKETBASE_URL}${pbPath}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify(body),
  });
}

async function pbPatch(pbPath: string, body: unknown): Promise<Response> {
  const token = await getToken();
  return fetch(`${POCKETBASE_URL}${pbPath}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify(body),
  });
}

async function pbDelete(pbPath: string): Promise<Response> {
  const token = await getToken();
  return fetch(`${POCKETBASE_URL}${pbPath}`, {
    method:  'DELETE',
    headers: { Authorization: token },
  });
}

// ─── Filter helper ────────────────────────────────────────────────────────────

function pbFilter(expr: string): string {
  return encodeURIComponent(`(${expr})`);
}

// ─── Guest helpers ────────────────────────────────────────────────────────────

async function getGuestByTicketId(ticketId: string): Promise<Guest | null> {
  const safe      = ticketId.replace(/'/g, "\\'");
  const filterUrl = `/api/collections/guests/records?filter=${pbFilter(`ticketId='${safe}'`)}&perPage=1`;
  const res       = await pbGet(filterUrl);
  if (!res.ok) { console.error(`[Server] getGuestByTicketId failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json() as { items: Guest[] };
  return data.items?.[0] ?? null;
}

async function getGuestByEmail(email: string): Promise<Guest | null> {
  const safe      = email.replace(/'/g, "\\'");
  const filterUrl = `/api/collections/guests/records?filter=${pbFilter(`email='${safe}'`)}&perPage=1`;
  const res       = await pbGet(filterUrl);
  if (!res.ok) { console.error(`[Server] getGuestByEmail failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json() as { items: Guest[] };
  return data.items?.[0] ?? null;
}

async function getAllGuests(): Promise<Guest[]> {
  const res = await pbGet(`/api/collections/guests/records?perPage=500`);
  if (!res.ok) { console.error('[Server] getAllGuests failed:', res.status, await res.text()); return []; }
  const data = await res.json() as { items: Guest[] };
  return data.items ?? [];
}

async function checkInGuest(guestId: string, scannerId: string): Promise<Guest> {
  const res = await pbPatch(`/api/collections/guests/records/${guestId}`, {
    checkedIn:   true,
    checkedInAt: new Date().toISOString(),
    checkedInBy: scannerId,
  });
  if (!res.ok) throw new Error(`checkInGuest failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Guest>;
}

async function createLog(log: Omit<Log, 'id'>): Promise<void> {
  const res = await pbPost(`/api/collections/logs/records`, log);
  if (!res.ok) console.error('[Server] createLog failed:', res.status, await res.text());
}

async function findGuestByFace(embedding: number[]): Promise<Guest | null> {
  const guests = await getAllGuests();
  let bestMatch: Guest | null = null;
  let bestScore = 0;
  for (const guest of guests) {
    if (!guest.faceEmbedding) continue;
    const score = cosineSimilarity(embedding, guest.faceEmbedding);
    if (score > bestScore && score >= FACE_SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = guest;
    }
  }
  return bestMatch;
}

// ─── Network / SSL ────────────────────────────────────────────────────────────

function getLocalIPs(): string[] {
  const ips: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const config of iface ?? []) {
      if (config.family === 'IPv4' && !config.internal) ips.push(config.address);
    }
  }
  return ips;
}

export function getOrCreateCert(certDir: string): { cert: Buffer; key: Buffer; localIPs: string[] } {
  const certPath    = path.join(certDir, 'cert.pem');
  const keyPath     = path.join(certDir, 'key.pem');
  const ipStampPath = path.join(certDir, 'cert-ips.json');

  fs.mkdirSync(certDir, { recursive: true });

  const currentIPs = getLocalIPs();
  let needsRegen   = true;

  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(ipStampPath)) {
    try {
      const stamped: string[] = JSON.parse(fs.readFileSync(ipStampPath, 'utf-8'));
      needsRegen = !(stamped.length === currentIPs.length && currentIPs.every(ip => stamped.includes(ip)));
    } catch { /* regen */ }
  }

  if (!needsRegen) {
    console.log(`[SSL] Using cached cert (IPs: ${currentIPs.join(', ')})`);
    return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), localIPs: currentIPs };
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 2, value: 'spotix-scanner.local' },
    { type: 7, ip: '127.0.0.1' },
    ...currentIPs.map(ip => ({ type: 7, ip })),
  ];

  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'spotix-scanner.local' }],
    { days: 3650, algorithm: 'sha256', keySize: 2048, extensions: [{ name: 'subjectAltName', altNames }] }
  );

  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath,  pems.private);
  fs.writeFileSync(ipStampPath, JSON.stringify(currentIPs));
  console.log(`[SSL] Cert generated — SANs: localhost, 127.0.0.1, ${currentIPs.join(', ')}`);

  return { cert: Buffer.from(pems.cert), key: Buffer.from(pems.private), localIPs: currentIPs };
}

// ─── State ────────────────────────────────────────────────────────────────────

const connectedScanners = new Map<string, { ws: SocketStream['socket']; scanner: Scanner }>();
const blockedScanners   = new Set<string>();

function broadcast(message: WSMessage, excludeId?: string): void {
  const data = JSON.stringify(message);
  connectedScanners.forEach(({ ws }, id) => {
    if (id !== excludeId && ws.readyState === ws.OPEN) ws.send(data);
  });
}

function sendToScanner(scannerId: string, message: WSMessage): void {
  const entry = connectedScanners.get(scannerId);
  if (entry && entry.ws.readyState === entry.ws.OPEN) entry.ws.send(JSON.stringify(message));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function registerRoutes(fastifyApp: FastifyInstance): void {
  fastifyApp.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') reply.status(204).send();
  });

  fastifyApp.get('/api/health', async (_req, reply) =>
    reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  );

  // ─── Guest CRUD ─────────────────────────────────────────────────────────────

  // GET all guests (for Manage Registry)
  fastifyApp.get('/api/guests', async (_req, reply) => {
    const res = await pbGet('/api/collections/guests/records?perPage=500&sort=+fullName');
    if (!res.ok) return reply.status(500).send({ error: 'Failed to fetch guests' });
    const data = await res.json() as { items: Guest[] };
    return reply.send(data.items ?? []);
  });

  // POST create single guest (Manage Registry — add new guest)
  fastifyApp.post<{ Body: Omit<Guest, 'id'> }>('/api/guests', async (req, reply) => {
    const { fullName, email, ticketId, ticketType, checkedIn, checkedInAt, checkedInBy, faceEmbedding } = req.body;

    if (!fullName?.trim() || !email?.trim() || !ticketId?.trim() || !ticketType?.trim()) {
      return reply.status(400).send({ error: 'fullName, email, ticketId, and ticketType are required' });
    }

    // Check for duplicate ticketId
    const existing = await getGuestByTicketId(ticketId.trim());
    if (existing) {
      return reply.status(409).send({ error: `Ticket ID "${ticketId}" already exists` });
    }

    const res = await pbPost('/api/collections/guests/records', {
      fullName:     fullName.trim(),
      email:        email.trim(),
      ticketId:     ticketId.trim(),
      ticketType:   ticketType.trim(),
      checkedIn:    checkedIn ?? false,
      checkedInAt:  checkedInAt ?? null,
      checkedInBy:  checkedInBy ?? null,
      faceEmbedding: Array.isArray(faceEmbedding) && faceEmbedding.length > 0 ? faceEmbedding : null,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Server] Create guest failed:', err);
      return reply.status(500).send({ error: 'Failed to create guest' });
    }

    const created = await res.json() as Guest;
    broadcast({ type: 'guests_imported', payload: { imported: 1, skipped: 0 } });
    return reply.status(201).send(created);
  });

  // PATCH update guest (Manage Registry — edit guest)
  fastifyApp.patch<{ Params: { id: string }; Body: Partial<Guest> }>('/api/guests/:id', async (req, reply) => {
    const { id } = req.params;
    const { fullName, email, ticketType, checkedIn, checkedInAt, checkedInBy, faceEmbedding } = req.body;

    // Build update payload — only include provided fields
    const update: Record<string, unknown> = {};
    if (fullName    !== undefined) update.fullName    = fullName.trim();
    if (email       !== undefined) update.email       = email.trim();
    if (ticketType  !== undefined) update.ticketType  = ticketType.trim();
    if (checkedIn   !== undefined) update.checkedIn   = checkedIn;
    if (checkedInAt !== undefined) update.checkedInAt = checkedInAt;
    if (checkedInBy !== undefined) update.checkedInBy = checkedInBy;
    if (faceEmbedding !== undefined) {
      update.faceEmbedding = Array.isArray(faceEmbedding) && faceEmbedding.length > 0
        ? faceEmbedding
        : null;
    }

    const res = await pbPatch(`/api/collections/guests/records/${id}`, update);
    if (!res.ok) {
      const err = await res.text();
      console.error('[Server] Update guest failed:', err);
      return reply.status(500).send({ error: 'Failed to update guest' });
    }

    const updated = await res.json() as Guest;
    return reply.send(updated);
  });

  // DELETE guest (Manage Registry)
  fastifyApp.delete<{ Params: { id: string } }>('/api/guests/:id', async (req, reply) => {
    const { id } = req.params;
    const res = await pbDelete(`/api/collections/guests/records/${id}`);
    if (!res.ok && res.status !== 404) {
      console.error('[Server] Delete guest failed:', res.status, await res.text());
      return reply.status(500).send({ error: 'Failed to delete guest' });
    }
    return reply.status(204).send();
  });

  // ─── Scanner management ─────────────────────────────────────────────────────

  fastifyApp.get('/api/scanners', async (_req, reply) => {
    const scanners = Array.from(connectedScanners.values()).map(e => ({
      ...e.scanner,
      status: blockedScanners.has(e.scanner.id) ? 'blocked' : 'active',
    }));
    return reply.send(scanners);
  });

  fastifyApp.post<{ Params: { scannerId: string } }>('/api/scanners/:scannerId/block', async (req, reply) => {
    const { scannerId } = req.params;
    blockedScanners.add(scannerId);
    sendToScanner(scannerId, { type: 'scanner_blocked', payload: { message: 'This scanner has been disabled by the admin.' } });
    broadcast({ type: 'scanner_blocked', payload: { scannerId } }, scannerId);
    return reply.send({ success: true });
  });

  fastifyApp.post<{ Params: { scannerId: string } }>('/api/scanners/:scannerId/unblock', async (req, reply) => {
    const { scannerId } = req.params;
    blockedScanners.delete(scannerId);
    sendToScanner(scannerId, { type: 'scanner_unblocked', payload: { message: 'Scanner has been re-enabled.' } });
    broadcast({ type: 'scanner_unblocked', payload: { scannerId } }, scannerId);
    return reply.send({ success: true });
  });

  // ─── Bulk guest import ──────────────────────────────────────────────────────

  fastifyApp.post<{ Body: { guests: Guest[] } }>('/api/guests/import', async (req, reply) => {
    const { guests } = req.body;
    if (!Array.isArray(guests)) return reply.status(400).send({ error: 'guests must be an array' });

    console.log(`[Server] Import started: ${guests.length} attendees recorded`);

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      console.error('[Server] Import aborted — auth failed:', e);
      return reply.status(500).send({ error: 'PocketBase authentication failed' });
    }

    let imported = 0, skipped = 0;

    for (const guest of guests) {
      if (!guest.fullName || !guest.email || !guest.ticketId || !guest.ticketType) {
        skipped++; continue;
      }
      try {
        const res = await fetch(`${POCKETBASE_URL}/api/collections/guests/records`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({
            fullName:     guest.fullName,
            email:        guest.email,
            ticketId:     guest.ticketId,
            ticketType:   guest.ticketType,
            checkedIn:    false,
            checkedInAt:  null,
            checkedInBy:  null,
            faceEmbedding: Array.isArray(guest.faceEmbedding) && guest.faceEmbedding.length > 0
              ? guest.faceEmbedding
              : null,
          }),
        });
        if (res.ok) { imported++; }
        else { skipped++; }
      } catch { skipped++; }
    }

    console.log(`[Server] Import done: ${imported} imported, ${skipped} skipped`);
    broadcast({ type: 'guests_imported', payload: { imported, skipped } });
    return reply.send({ imported, skipped });
  });

  // ─── Scan ───────────────────────────────────────────────────────────────────

  fastifyApp.post<{ Body: ScanRequest }>('/api/scan', async (req, reply) => {
    const { ticketId, email, faceEmbedding, scannerId } = req.body;

    if (blockedScanners.has(scannerId))
      return reply.status(403).send({ result: 'blocked', message: 'Scanner is blocked.' });

    let guest: Guest | null = null;
    if (ticketId)                    guest = await getGuestByTicketId(ticketId);
    else if (email)                  guest = await getGuestByEmail(email);
    else if (faceEmbedding?.length)  guest = await findGuestByFace(faceEmbedding);

    const now     = new Date();
    const logBase = {
      scannerId,
      timestamp:     now.toISOString(),
      checkedInDate: getCheckedInDate(),
      checkedInTime: getCheckedInTime(),
      note:          null,
    };

    if (!guest) {
      await createLog({ ...logBase, ticketId: ticketId || 'UNKNOWN', guestName: 'Unknown', result: 'invalid' });
      broadcast({ type: 'scan_result', payload: { log: { ...logBase, result: 'invalid' }, guest: null } });
      return reply.send({ result: 'invalid', message: 'Ticket not found.' });
    }

    if (guest.checkedIn) {
      await createLog({ ...logBase, ticketId: guest.ticketId, guestName: guest.fullName, result: 'already_scanned' });
      broadcast({ type: 'scan_result', payload: { log: { ...logBase, result: 'already_scanned' }, guest } });
      return reply.send({ result: 'already_scanned', message: `${guest.fullName} has already been checked in.`, guest });
    }

    const updatedGuest = await checkInGuest(guest.id, scannerId);
    await createLog({ ...logBase, ticketId: guest.ticketId, guestName: guest.fullName, result: 'success' });

    const entry = connectedScanners.get(scannerId);
    if (entry) { entry.scanner.scanCount++; entry.scanner.lastScanAt = now.toISOString(); }

    broadcast({ type: 'scan_result', payload: { log: { ...logBase, result: 'success' }, guest: updatedGuest } });
    return reply.send({ result: 'success', message: `Welcome, ${guest.fullName}!`, guest: updatedGuest });
  });

  // ─── Event end ──────────────────────────────────────────────────────────────

  fastifyApp.post('/api/event/end', async (_req, reply) => {
    broadcast({ type: 'event_ended', payload: { message: 'The event has ended.' } });
    connectedScanners.clear();
    blockedScanners.clear();
    _adminToken = null;
    return reply.send({ success: true });
  });
}

// ─── Server Factory ───────────────────────────────────────────────────────────

export async function createServer(options: {
  certDir: string;
  staticDir: string;
  port: number;
  httpPort: number;
}): Promise<{ start: () => Promise<string>; stop: () => Promise<void>; httpAddress: string }> {
  const { cert, key, localIPs } = getOrCreateCert(options.certDir);

  const fastify     = Fastify({ https: { cert, key }, logger: false });
  const httpFastify = Fastify({ logger: false });

  await fastify.register(fastifyWebsocket);
  await fastify.register(fastifyStatic, {
    root:     options.staticDir,
    prefix:   '/',
    index:    'index.html',
    wildcard: false,
    setHeaders: (res, filePath) => {
      if (!path.extname(filePath)) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    },
  });

  await httpFastify.register(fastifyWebsocket);
  await httpFastify.register(fastifyStatic, {
    root:     options.staticDir,
    prefix:   '/',
    index:    'index.html',
    wildcard: false,
    setHeaders: (res, filePath) => {
      if (!path.extname(filePath)) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    },
  });

  registerRoutes(fastify);
  registerRoutes(httpFastify);

  // SPA fallback — only for extensionless routes (actual page navigations)
  const spaFallback = async (req: FastifyRequest, reply: FastifyReply) => {
    const url          = req.url.split('?')[0];
    const hasExtension = path.extname(url) !== '';
    if (hasExtension) return reply.status(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  };

  fastify.setNotFoundHandler(spaFallback);
  httpFastify.setNotFoundHandler(spaFallback);

  // WebSocket
  const wsHandler = (socket: SocketStream, req: any) => {
    const url         = new URL(req.url!, `https://localhost`);
    const scannerId   = url.searchParams.get('scannerId') || `scanner-${Date.now()}`;
    const scannerName = url.searchParams.get('name') || scannerId;

    const scanner: Scanner = {
      id:          scannerId,
      name:        scannerName,
      status:      blockedScanners.has(scannerId) ? 'blocked' : 'active',
      scanCount:   0,
      connectedAt: new Date().toISOString(),
      lastScanAt:  null,
    };

    connectedScanners.set(scannerId, { ws: socket.socket, scanner });

    if (blockedScanners.has(scannerId)) {
      sendToScanner(scannerId, { type: 'scanner_blocked', payload: { message: 'This scanner has been disabled by the admin.' } });
    }

    broadcast({ type: 'scanner_joined', payload: scanner });

    socket.socket.on('close', () => {
      connectedScanners.delete(scannerId);
      broadcast({ type: 'scanner_left', payload: { scannerId } });
    });
  };  

  fastify.get('/ws', { websocket: true }, wsHandler);
  httpFastify.get('/ws', { websocket: true }, wsHandler);

  let _httpAddress = '';

  return {
    start: async () => {
      const address = await fastify.listen({ port: options.port, host: '0.0.0.0' });
      console.log(`[Server] HTTPS (scanners) → ${address}`);
      console.log(`[Server] Reachable at: ${localIPs.map(ip => `https://${ip}:${options.port}`).join(', ')}`);
      _httpAddress = await httpFastify.listen({ port: options.httpPort, host: '127.0.0.1' });
      try { await getToken(); console.log('[Server] Database auth verified'); }
      catch (e) { console.error('[Server] WARNING: Database auth failed on startup:', e); }
      return address;
    },
    stop: async () => { await fastify.close(); await httpFastify.close(); },
    get httpAddress() { return _httpAddress; },
  };
}