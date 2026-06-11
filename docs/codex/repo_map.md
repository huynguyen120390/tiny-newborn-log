When to read this file:
Read this before repo navigation, setup, entry-point changes, or command discovery.

# Repo Map

## Main Folders

- `backend/`: Node.js built-in `http` server and export generation.
- `frontend/`: static HTML, CSS, JS, images, and icons.
- `data/`: local JSON app data and recent-state cache.
- `scripts/`: one-off maintenance utilities.
- `docs/codex/`: lightweight maps for future Codex sessions.
- `C:\codelab\apps\TinyNewbornLogServers\`: dedicated runtime checkouts for dev/staging/main/prod servers. See `branch_server_map.md`.

## Entry Points

- `backend/server.js`: starts HTTP server, serves static files, owns API routes.
- `frontend/index.html`: tab layout, dialogs, export template, script/style includes.
- `frontend/app.js`: browser state, event handlers, rendering, API calls.
- `frontend/styles.css`: app styling and responsive layout.
- `backend/exportService.js`: JSON/CSV/PDF/XLSX report creation.

## Important Config Files

- `package.json`: app metadata and `npm start` command.
- `.gitignore`: ignore rules.
- `README.md`: user setup, network access, API notes.
- `start.bat`: Windows launcher for default local server.
- `start-phuongnamcuti.bat`: Windows launcher for friendly local host setup.

## Data Files

- `data/appData.json`: baby profile, logs, milestones, goals, settings.
- `data/recentInfo.json`: recent UI defaults and last activity timestamps.
- `backend/exports/.gitkeep`: placeholder for generated export files.

## Build/Run Commands

- Install: no npm packages required.
- Run default: `npm start`.
- Run direct: `node backend/server.js`.
- Run app port: `node backend/server.js 3002`.
- Run data mode: `node scripts/start-mode.js dev 3003`, `node scripts/start-mode.js staging 3004`, or `node scripts/start-mode.js prod 3002`.
- Server Control: `node scripts/ops-server.js 3010`.
- Windows run: `start.bat`.
- Friendly-name run: `start-phuongnamcuti.bat`.

## Branch/Server Warning

- Do not assume the current editing checkout is the live production checkout.
- `3002` must run from `C:\codelab\apps\TinyNewbornLogServers\prod`.
- `3003` must run from `C:\codelab\apps\TinyNewbornLogServers\dev`.
- Code edited in `C:\Users\Huy\Documents\TinyNewbornLog` should be committed/pushed, then synced into the matching runtime checkout before server verification.
- Read `branch_server_map.md` before changing branch/server behavior.

## Generated/Do-Not-Scan

- Do not scan `.git/`.
- Do not scan generated export files unless debugging exports.
- Avoid broad reads of image assets; inspect names first.
