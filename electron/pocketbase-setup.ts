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



import { spawn } from 'child_process';

const POCKETBASE_URL = 'http://127.0.0.1:8090';

export async function setupPocketBase(
  userDataPath: string,
  pbBinaryPath: string,
  pbDataDir: string,
  adminEmail: string,
  adminPassword: string
): Promise<void> {
  console.log('[DB Setup] Running setup...');

  // Step 1: Create superuser via CLI (idempotent — safe to run every time)
  await upsertSuperuser(pbBinaryPath, pbDataDir, adminEmail, adminPassword);

  // Step 2: Wait for PocketBase to settle
  await new Promise(r => setTimeout(r, 2000));

  // Step 3: Authenticate and get token
  let token: string;
  try {
    token = await authenticate(adminEmail, adminPassword);
  } catch (err) {
    console.error('[DB Setup] Auth failed, so, skipping collection creation:', err);
    return;
  }

  // Step 4: Create collections if missing
  // Open API rules — allow all operations (server is local, auth handled by LAN server)
  const openRules = {
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
  };

  // PocketBase 0.21 uses "fields" (not "schema") 
  // Field types in 0.21: text, number, bool, email, url, date, select, json,
  //   file, relation, user. The old "schema" key is ignored silently, which
  //   is why records showed only an id with no other data.
  // https://github.com/pocketbase/pocketbase/tree/v0.21.3

  await ensureCollection(token, 'guests', {
    name: 'guests',
    type: 'base',
    ...openRules,
    fields: [
      { name: 'fullName',      type: 'text',   required: true  },
      { name: 'email',         type: 'text',   required: true  },
      { name: 'ticketId',      type: 'text',   required: true  },
      { name: 'ticketType',    type: 'text',   required: true  },
      { name: 'checkedIn',     type: 'bool',   required: false },
      { name: 'checkedInAt',   type: 'text',   required: false },
      { name: 'checkedInBy',   type: 'text',   required: false },
      { name: 'faceEmbedding', type: 'json',   required: false },
    ],
  });

  await ensureCollection(token, 'logs', {
    name: 'logs',
    type: 'base',
    ...openRules,
    fields: [
      { name: 'ticketId',      type: 'text',   required: true  },
      { name: 'guestName',     type: 'text',   required: true  },
      { name: 'scannerId',     type: 'text',   required: true  },
      { name: 'result',        type: 'text',   required: true  },
      { name: 'timestamp',     type: 'text',   required: true  },
      { name: 'checkedInDate', type: 'text',   required: true  },
      { name: 'checkedInTime', type: 'text',   required: true  },
      { name: 'note',          type: 'text',   required: false },
    ],
  });

  console.log('[DB Setup] Setup complete');
}

export async function resetSetupFlag(userDataPath: string): Promise<void> {
  // No-op — setup runs on every launch, collections are idempotent
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function upsertSuperuser(
  pbBinaryPath: string,
  pbDataDir: string,
  email: string,
  password: string
): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(pbBinaryPath, [
      'superuser', 'upsert', email, password,
      `--dir=${pbDataDir}`,
    ]);
    proc.stdout?.on('data', (d: Buffer) => console.log(`[DB Setup] ${d.toString().trim()}`));
    proc.stderr?.on('data', (d: Buffer) => console.log(`[DB Setup] ${d.toString().trim()}`));
    proc.on('close', () => resolve());
  });
}

async function authenticate(email: string, password: string): Promise<string> {
  const endpoints = [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password',
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${POCKETBASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
      });
      if (res.ok) {
        const data = await res.json() as { token: string };
        console.log(`[DB Setup] Authenticated via ${endpoint}`);
        return data.token;
      }
    } catch {}
  }
  throw new Error('All auth endpoints failed');
}

async function ensureCollection(
  token: string,
  name: string,
  schema: object
): Promise<void> {
  const check = await fetch(`${POCKETBASE_URL}/api/collections/${name}`, {
    headers: { Authorization: token },
  });

  if (check.ok) {
    console.log(`[DB Setup] Collection "${name}" exists — patching fields + rules...`);

    // IMPORTANT: patch with "fields" (0.21 format) not "schema"
    const update = await fetch(`${POCKETBASE_URL}/api/collections/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify(schema),   // send the full schema including fields
    });

    if (update.ok) {
      console.log(`[DB Setup] Collection "${name}" updated`);
    } else {
      console.error(`[DB Setup] Failed to update "${name}": ${await update.text()}`);
    }
    return;
  }

  // Create fresh
  const create = await fetch(`${POCKETBASE_URL}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(schema),
  });

  if (create.ok) {
    console.log(`[DB Setup] Created collection "${name}"`);
  } else {
    const err = await create.text();
    console.error(`[DB Setup] Failed to create "${name}": ${err}`);
  }
}