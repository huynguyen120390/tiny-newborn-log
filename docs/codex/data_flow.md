When to read this file:
Read this when tracing state, API calls, persistence, or UI refresh behavior.

# Data Flow

## Startup

- Browser loads `/` -> `frontend/index.html`.
- HTML loads `/styles.css` and `/app.js`.
- `init` sets handlers -> `refreshData`.
- `refreshData` fetches `/api/app-data`, `/api/recent`, `/api/today-summary`.
- Frontend stores responses in `state` -> `renderAll`.

## Quick Activity Log

- User taps activity card -> `createLog`.
- `createLog` POSTs `/api/logs`.
- `backend/server.js` reads body -> `buildLog`.
- Backend validates paired transitions when relevant.
- Backend appends to `data/appData.json`.
- Backend updates `data/recentInfo.json`.
- Backend returns new log, recent state, today summary.
- Frontend updates `state` -> `renderAll` -> toast/reaction.

## Bottle Log

- User opens bottle card -> bottle dialog.
- Slider chooses ounces -> form submit.
- Frontend POSTs `/api/logs` with bottle payload.
- Backend saves log and updates recent bottle ounces.
- Frontend refreshes cards, Recent Info, Today totals.

## Edit Existing Log

- User edits History row or activity-card log row.
- Frontend PUTs `/api/logs/:id`.
- Backend finds log in `baby_log`.
- Backend applies editable fields only.
- Backend revalidates paired transitions.
- Backend rebuilds recent cache from all logs.
- Frontend replaces local log and re-renders.

## Clear Logs

- User clicks Settings clear data.
- Frontend DELETEs `/api/logs`.
- Backend empties `baby_log`.
- Backend rebuilds default recent cache.
- Frontend clears log state and today metrics.

## Milestone Progress

- User opens milestone dialog -> selects state.
- Frontend sends PUT `/api/milestones/:id`.
- Backend normalizes legacy statuses.
- Backend writes `milestone_progress` in `data/appData.json`.
- Frontend updates milestone cards and next milestone.

## Profile And Sound Settings

- Birthday form -> PUT `/api/profile`.
- Backend updates `baby_profile.birthday`.
- Sound toggle -> PUT `/api/sound-settings`.
- Backend updates `sound_settings`.
- Frontend re-renders header/settings from returned data.

## Export

- User submits Export form.
- Frontend fetches `/api/export/:format` with range query.
- Backend resolves date range.
- `exportService` loads `data/appData.json`.
- `makeReport` filters logs and computes summaries/warnings.
- Save helper writes file under `backend/exports/`.
- Backend streams file as download.

## Local-Only State

- Visible activity cards live in browser `localStorage`.
- Reminder interval and voice preference live in browser `localStorage`.
- Shared logs/settings live in JSON files on disk.
