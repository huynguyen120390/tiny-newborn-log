When to read this file:
Read this before repo navigation, setup, entry-point changes, or command discovery.

# Repo Map

## Main Folders

- `backend/`: Node.js built-in `http` server and export generation.
- `frontend/`: static HTML, CSS, JS, images, and icons.
- `data/`: local JSON app data and recent-state cache.
- `scripts/`: one-off maintenance utilities.
- `docs/codex/`: lightweight maps for future Codex sessions.

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
- Run custom port: `node backend/server.js 3001`.
- Windows run: `start.bat`.
- Friendly-name run: `start-phuongnamcuti.bat`.

## Generated/Do-Not-Scan

- Do not scan `.git/`.
- Do not scan generated export files unless debugging exports.
- Avoid broad reads of image assets; inspect names first.
