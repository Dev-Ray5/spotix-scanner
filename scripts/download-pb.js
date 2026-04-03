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


const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ── Config — update version here when PocketBase releases 
const PB_VERSION = '0.36.8';

const TARGETS = {
  win32:  { folder: 'electron/pocketbase-win',   zip: `pocketbase_${PB_VERSION}_windows_amd64.zip`  },
  darwin: { folder: 'electron/pocketbase-mac',   zip: `pocketbase_${PB_VERSION}_darwin_amd64.zip`   },
  linux:  { folder: 'electron/pocketbase-linux',  zip: `pocketbase_${PB_VERSION}_linux_amd64.zip`    },
};

const platform = process.platform;
const target   = TARGETS[platform];

if (!target) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const BASE_URL  = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}`;
const ZIP_URL   = `${BASE_URL}/${target.zip}`;
const OUT_DIR   = path.resolve(target.folder);
const ZIP_PATH  = path.join(OUT_DIR, 'pb.zip');
const BIN_NAME  = platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const BIN_PATH  = path.join(OUT_DIR, BIN_NAME);

// Skip if binary already exists
if (fs.existsSync(BIN_PATH)) {
  console.log(`[PocketBase] Binary already exists at ${BIN_PATH}, skipping download.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

console.log(`[PocketBase] Downloading v${PB_VERSION} for ${platform}...`);
console.log(`[PocketBase] URL: ${ZIP_URL}`);

// ── Download ──────────────────────────────────────────────────────────────────
function download(url, dest, redirects = 0) {
  if (redirects > 5) { console.error('Too many redirects'); process.exit(1); }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      // Follow GitHub's redirect to the actual S3 download URL
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return resolve(download(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

// ── Unzip ─────────────────────────────────────────────────────────────────────
async function main() {
  await download(ZIP_URL, ZIP_PATH);
  console.log('[PocketBase] Download complete. Extracting...');

  // Use platform-native unzip tools — no extra npm deps needed
  if (platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${OUT_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o "${ZIP_PATH}" -d "${OUT_DIR}"`, { stdio: 'inherit' });
  }

  fs.unlinkSync(ZIP_PATH); // clean up the zip
  console.log(`[PocketBase] Ready at ${BIN_PATH} ✓`);
}

main().catch(err => { console.error(err); process.exit(1); });