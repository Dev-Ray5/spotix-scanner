# Spotix Scanner

The professional offline event check-in system for Spotix events.

---

## What It Does

Spotix Scanner runs entirely on your laptop with no internet required at the event. It:

- Imports a `guests.json` guest list into a local SQLite database 
- Serves the scanner UI over local WiFi that scanner devices connect to via browser
- Validates check-ins by QR code, email, or facial recognition
- Shows a real-time admin dashboard with charts, live feed, and scanner management
- Exports logs as CSV and/or JSON at the end of the event
- Auto-updates from GitHub Releases when internet is available and update is available

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Local database | SQLite, embedded binary |
| Local server | Fastify + HTTPS (self-signed SSL Cert) |
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
git clone https://github.com/spotix-technologies/spotix-scanner.git
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


## Development

### Run Next.js dev server (UI only)

This means that you will only be able to view the UI being served. The Web socket server will not be available in the UI dev server

```bash
cd nextjs-app
npm run dev
```

Opens at `http://localhost:3001`

### Run full Electron app in dev mode

```bash
# First time only — build the Next.js static export so Fastify can serve
# the scanner page to scanner devices over HTTPS
npm run build:UI

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

But tbvh, I got like bored of always compiling the two of them cos they were the bulk of the stress so just compiling electron also did compile the server. It just felt better that way

### Package for Windows

```bash
npm run pkg:win
```

Output: `release/Spotix Scanner Setup x.x.x.exe`

### Package for macOS

```bash
npm run pkg:mac
```

Output: `release/Spotix Scanner-x.x.x.dmg`

*Do note that you can't compile the mac version on a windows machine*

---

## Publishing a Release (Auto-Update)

1. Bump version in `package.json`
2. Set `GH_TOKEN` environment variable (GitHub personal access token with `repo` scope)
3. Push the code as per normal
4. git tag the commit like:

```bash
git tag vx.x.x #Semver
git push origin vx.x.x
```

*No tag = No GH action*


electron-builder will:
- Build and package the app
- Create a GitHub Release draft
- Upload the installer + `latest.yml` update manifest

4. Go to GitHub → Releases → publish the draft release

When organizers open the app with internet, they'll be prompted to update.

---

## Project Structure in this version

```
spotix-scanner/
├── .github/workflows/
│   |── release.yml           
├── electron/
│   ├── main.ts              ← App entry, spawns PocketBase + Fastify
│   ├── menu.ts              ← The menu data for the IPC bridge
│   ├── preload.ts           ← IPC bridge (window.spotix)
│   ├── updater.ts           ← GitHub Releases auto-update
│   ├── pocketbase-setup.ts  ← First-run collection creation
│   └── pocketbase[-win]     ← PocketBase binary 
├── server/
│   |── fastify.ts           ← HTTPS server, scan API, WebSocket
│   ├── types.ts             ← Shared types for server layer
│   ├── preload.ts           ← Standalone utils for server layer
├── nextjs-app/
│   ├── app/
│   │   ├── dashboard/       ← Admin dashboard page
│   │   |── scanner/         ← Scanner UI page
│   │   ├── logs/            ← Event logs visualizer
│   │   └── manage/          ← Manage guest registry
│   ├── components/
│   │   ├── admin/           ← Admin dashboard components
│   │   |── scanner/         ← Scanner UI components
│   │   ├── manage/          ← Event logs components
│   ├── lib/                 ← PocketBase client, hooks, utils, FR logic
│   └── types/               ← Shared TypeScript types
├── assets/                  ← Icons and installer images
├── scripts/
│   |── download-pb.js       ← Downloads binary for release
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

`faceEmbedding` is optional — only present if the attendee enrolled their face on Spotix post ticket purchase.

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


# Running Spotix Scanner on Android (Termux)

> **Compatibility Notice**
> Android support is experimental and not officially supported in this version. This guide is provided for advanced users only. iOS is **not supported** and will not work under any circumstances. Use of Android is not advised and may be challenging to non techies but anyways:

---

## Requirements

- An Android device (Android 8.0 or higher recommended)
- [Termux](https://f-droid.org/en/packages/com.termux/) — install from **F-Droid only**. The Google Play version is deprecated and **will** cause issues.
- At least **2GB of free storage**
- A stable internet connection for the **initial** setup

---

## Step 1 — Install Termux

1. Download and install **F-Droid** from [f-droid.org](https://f-droid.org)
2. Open F-Droid and search for **Termux** and install

---

## Step 2 — Update Termux packages

Open Termux and run:

```bash
pkg update && pkg upgrade -y
```

When prompted about any config file changes, press **Enter** to keep the default.

---

## Step 3 — Install Node.js and required tools

```bash
pkg install -y nodejs-lts git unzip
```

Verify the installations:

```bash
node -v
npm -v
git --version
```

All three should print version numbers. If any fail, re-run the install command.

---

## Step 4 — Clone the repository

```bash
git clone https://github.com/spotix-technologies/spotix-scanner.git
cd spotix-scanner
```

---

## Step 5 — Install root dependencies

```bash
npm install
```

---

## Step 6 — Install UI dependencies

```bash
npm install --prefix nextjs-app
```

---

## Step 7 — Download PocketBase for Linux (ARM)

The standard `download-pb.js` script fetches the `linux_amd64` binary which will **not** run on Android ARM. You need the ARM64 build instead.

Run this manually to download the correct binary:

```bash
mkdir -p electron/pocketbase-linux

curl -L -o electron/pocketbase-linux/pb.zip \
  https://github.com/pocketbase/pocketbase/releases/download/v0.22.4/pocketbase_0.22.4_linux_arm64.zip

unzip -o electron/pocketbase-linux/pb.zip -d electron/pocketbase-linux/
rm electron/pocketbase-linux/pb.zip
chmod +x electron/pocketbase-linux/pocketbase
```
> Why Linux though? Your android is actually built with some parts of linux and Termux can access that which is why the terminal is linux based and you use Linux command in Termux terminal

---

## Step 8 — Build the app

Since Electron does not run on Android, you will run the **Next.js UI and Fastify/PocketBase server directly** without the Electron wrapper.

```bash
npm run build:UI
npm run build:server
```

---

## Step 9 — Start the server

```bash
node dist/server/fastfy.js
```

The server will start on port **3001** (HTTP). You should see output like:

```
Server listening at http://0.0.0.0:3001
```

---

## Step 10 — Access the UI

Open any browser on your Android device (Chrome recommended) and navigate to:

```
http://localhost:3001
```

The full Spotix Scanner interface will load in the browser. All scanning features including QR, Ticket ID, and Email modes will work. The **Face scanning tab requires camera permission** — grant it when the browser prompts you.

---

## Keeping it running in the background

By default Termux will stop the server if you switch apps. To keep it running:

1. Long-press the Termux notification and select **Acquire wakelock**
2. Or install **Termux:Boot** from F-Droid to auto-start the server on device boot

---

## Accessing from other devices on the same network

If you want scanners on other phones or tablets to connect to the Android-hosted server:

1. Find your Android device's local IP:
```bash
ip addr show | grep 'inet '
```
Look for an address like `192.168.x.x`

2. On the other devices, open a browser and go to:
```
http://192.168.x.x:3001/scanner
```

This turns your Android device into a portable event server that other devices can connect to over Wi-Fi — no laptop needed.

---

## Troubleshooting

**`node: not found` after installing**
Close and reopen Termux completely, then retry.

**`permission denied` on PocketBase binary**
```bash
chmod +x electron/pocketbase-linux/pocketbase
```

**Port 3001 already in use**
```bash
pkill -f "node dist/server"
node dist/server/index.js
```

**Camera not working in browser**
Chrome on Android requires HTTPS for camera access except on `localhost`. Since the server runs on `localhost`, it should work. If it doesn't, try navigating to `http://127.0.0.1:3001` instead.

**Build fails with out-of-memory error**
Termux has limited memory access by default. Try:
```bash
export NODE_OPTIONS="--max-old-space-size=512"
npm run build:UI
```

---

## Final Notes

> ### ⚠️ Dependency Lock Warning
>
> **`fastify` and `pocketbase` must never be updated without prior consultation with the CTO or a core maintainer.**
>
> These two packages are tightly coupled to the internal server architecture and PocketBase schema. A version bump — even a minor one — can silently break authentication, real-time sync, WebSocket behaviour, or the database migration chain.
>
> **Any pull requests that update `fastify` or `pocketbase` in `package.json` will be closed and removed without review.**
>
> If you believe an update is necessary, open a discussion issue first and tag the CTO or core maintainer.


## License

Copyright © 2026 Spotix · spotix.com.ng
