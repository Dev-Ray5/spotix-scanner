// PocketBase client - browser/Next.js only (ESM compatible)
// For server/electron, use direct fetch calls to PocketBase REST API

export const POCKETBASE_URL = 'http://127.0.0.1:8090';

// Dynamic import for Next.js context only
export async function getPocketBase() {
  const PocketBase = (await import('pocketbase')).default;
  return new PocketBase(POCKETBASE_URL);
}

import type { Guest } from '../types/guest';
import type { Log } from '../types/log';

// ─── Direct REST helpers (used in server/electron - no SDK needed) ────────────

export async function pbGet(path: string, token?: string): Promise<Response> {
  return fetch(`${POCKETBASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
  });
}

export async function pbPost(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${POCKETBASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function pbPatch(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${POCKETBASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function waitForPocketBase(
  maxRetries: number = 20,
  intervalMs: number = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${POCKETBASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      await new Promise((res) => setTimeout(res, intervalMs));
    }
  }
  return false;
}