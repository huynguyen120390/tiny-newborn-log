When to read this file:
Start here when you need a low-token guide to the Codex navigation maps.

# Codex Maps

- Read `repo_map.md` for folders, entry points, config, and run commands.
- Read `feature_map.md` when changing a user-facing feature.
- Read `data_flow.md` when tracing how UI actions reach storage and re-render.
- Read `debug_paths.md` when diagnosing a bug or deciding where to inspect first.
- Read `branch_server_map.md` before changing branches, starting servers, or debugging dev/staging/prod differences.

## Fast Paths

- Backend/API task: read `repo_map.md`, then `data_flow.md`.
- UI/rendering task: read `feature_map.md`, then inspect `frontend/app.js` symbols by name.
- Export/report task: read `feature_map.md`, then inspect `backend/exportService.js`.
- Data/schema task: read `data_flow.md`, then inspect `data/appData.json` keys only.
- Styling/layout task: read `feature_map.md`, then inspect targeted selectors in `frontend/styles.css`.
- Startup/network task: read `branch_server_map.md`, then `repo_map.md` and `debug_paths.md`.
- Branch promotion task: read `branch_server_map.md` first.

## Repo Rules

- Do not scan generated folders: `node_modules`, `dist`, `build`, `coverage`, `bin`, `obj`, `venv`, `.git`.
- Keep future exploration targeted with `rg`.
- Prefer the existing no-dependency Node/static frontend style.
- Do not refactor unrelated code while using these maps.
