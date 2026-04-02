# Spotix Scanner

Professional offline event check-in system for Spotix events.

---

## What It Does

Spotix Scanner runs entirely on the organizer's laptop — no internet required at the event. It:

- Imports a `guests.json` guest list into a local SQLite database (PocketBase)
- Serves a scanner UI over local WiFi that scanner devices connect to via browser
- Validates check-ins by QR code, email, or facial recognition
- Shows a real-time admin dashboard with charts, live feed, and scanner management
- Exports logs as CSV and/or JSON at the end of the event
- Auto-updates from GitHub Releases when internet is available

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Local database | PocketBase (SQLite, embedded binary) |
| Local server | Fastify + HTTPS (self-signed SSL) |
| Admin + Scanner UI | Next.js (static export) |
| Language | TypeScript throughout |
| Packaging | electron-builder (NSIS/Windows, DMG/Mac) |
| Auto-update | electron-updater + GitHub Releases |

---

## Prerequisites

- Node.js 20+
- npm 10+
- PocketBase binary (see below)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/spotix/spotix-scanner.git
cd spotix-scanner
npm install
cd nextjs-app && npm install && cd ..
```

### 2. Add PocketBase binary

Download the PocketBase binary for your platform from https://pocketbase.io/docs/

Place it at:

```
electron/pocketbase          # macOS / Linux
electron/pocketbase-win      # Windows (.exe)
```

Make it executable (macOS/Linux):

```bash
chmod +x electron/pocketbase
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if you want to change the default PocketBase admin credentials.

### 4. Add placeholder assets

Place the following in `assets/`:
- `icon.ico` — Windows app icon (256x256)
- `icon.icns` — macOS app icon
- `installer-banner.bmp` — NSIS sidebar image (164x314px)
- `installer-header.bmp` — NSIS header image (150x57px)

Place the following in `resources/`:
- `terms.pdf` — Terms & Conditions document
- `operation-guide.pdf` — User operation guide

### 5. Add face-api.js models

Download the following models from the face-api.js repo and place them in `nextjs-app/public/models/`:

```
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1
face_landmark_68_model-weights_manifest.json
face_landmark_68_model-shard1
face_recognition_model-weights_manifest.json
face_recognition_model-shard1
```

Models available at: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

---

## Development

### Run Next.js dev server (UI only)

```bash
cd nextjs-app
npm run dev
```

Opens at `http://localhost:3001`

### Run full Electron app in dev mode

```bash
# First time only — build the Next.js static export so Fastify can serve
# the scanner page to scanner devices over HTTPS
npm run build:next

# Then start everything with one command
npm run dev
```

`npm run dev` starts three processes concurrently:
- **NEXT** — Next.js dev server on port 3001 (admin dashboard, hot reload)
- **TSC** — TypeScript compiler in watch mode (electron + server)
- **ELECTRON** — waits for Next.js to be ready, then launches the Electron window

The admin dashboard loads from the Next.js dev server (hot reload works).
Scanner devices connect via Fastify over HTTPS (serves the static `out/` folder).

---

## Building for Production

### Build all layers

```bash
npm run build
```

This runs:
1. `next build` → generates static export in `nextjs-app/out/`
2. `tsc` on `electron/` → compiles to `dist/electron/`
3. `tsc` on `server/` → compiles to `dist/server/`

### Package for Windows

```bash
npm run package:win
```

Output: `release/Spotix Scanner Setup x.x.x.exe`

### Package for macOS

```bash
npm run package:mac
```

Output: `release/Spotix Scanner-x.x.x.dmg`

---

## Publishing a Release (Auto-Update)

1. Bump version in `package.json`
2. Set `GH_TOKEN` environment variable (GitHub personal access token with `repo` scope)
3. Run:

```bash
GH_TOKEN=your_token npm run package:win
# or
GH_TOKEN=your_token npm run package:mac
```

electron-builder will:
- Build and package the app
- Create a GitHub Release draft
- Upload the installer + `latest.yml` update manifest

4. Go to GitHub → Releases → publish the draft release

When organizers open the app with internet, they'll be prompted to update.

---

## Project Structure

```
spotix-scanner/
├── electron/
│   ├── main.ts              ← App entry, spawns PocketBase + Fastify
│   ├── preload.ts           ← IPC bridge (window.spotix)
│   ├── updater.ts           ← GitHub Releases auto-update
│   ├── pocketbase-setup.ts  ← First-run collection creation
│   └── pocketbase[-win]     ← PocketBase binary (you add this)
├── server/
│   └── fastify.ts           ← HTTPS server, scan API, WebSocket
├── nextjs-app/
│   ├── app/
│   │   ├── dashboard/       ← Admin dashboard page
│   │   └── scanner/         ← Scanner UI page
│   ├── components/admin/    ← All dashboard components
│   ├── lib/                 ← PocketBase client, hooks, utils
│   └── types/               ← Shared TypeScript types
├── assets/                  ← Icons and installer images
├── resources/               ← PDFs bundled in installer
├── electron-builder.yml
└── package.json
```

---

## guests.json Format

```json
[
  {
    "fullName": "Ada Obi",
    "email": "ada@example.com",
    "ticketId": "TKT-001",
    "ticketType": "VIP",
    "faceEmbedding": [0.142, -0.033, ...]
  }
]
```

`faceEmbedding` is optional — only present if the attendee enrolled their face on Spotix.

---

## Scanner Device Setup

1. Organizer opens Spotix Scanner on their laptop
2. Admin dashboard shows a QR code in the "Connect Scanners" card
3. Scanner staff scan the QR code with their phone
4. Browser opens the scanner URL (HTTPS self-signed)
5. Browser shows a security warning — tap **Advanced → Proceed**
6. Scanner enters a name (e.g. "Gate 1") and starts scanning

Scanner devices must be on the same WiFi network as the organizer's laptop.
For reliability at events, the organizer's laptop can create a hotspot that scanner devices connect to.

---

## End of Event

1. Click **End Event** in the top-right of the admin dashboard
2. Review the event summary
3. Choose export format: CSV, JSON, or Both
4. Files are saved to the organizer's Downloads folder
5. All scanner devices are disconnected and their UI is locked
6. The database is wiped clean for the next event

---

## License

Copyright © 2024 Spotix · spotix.com.ng
