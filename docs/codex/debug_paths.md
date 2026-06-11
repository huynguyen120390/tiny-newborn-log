When to read this file:
Read this when a bug report arrives and you need the shortest useful inspection path.

# Debug Paths

## Page Stuck On Loading Profile

- Start with `backend/server.js` static/API routes.
- Check `/api/app-data`, `/api/recent`, `/api/today-summary`.
- Inspect `data/appData.json` JSON validity.
- Inspect browser console around `refreshData` and `fetchJson`.
- Check cache-busting query strings in `frontend/index.html`.

## Server Will Not Start

- First read `branch_server_map.md` to confirm the intended checkout folder, branch, port, and data mode.
- Start with `package.json` and `backend/server.js`.
- Check port argument, `PORT`, or occupied port.
- Check malformed JSON in `data/appData.json` or `data/recentInfo.json`.
- Check Windows launcher if using `.bat` files.
- If Server Control starts the wrong code, inspect `scripts/ops-server.js` target roots.

## Phone Cannot Reach App

- First identify the intended port in `branch_server_map.md`.
- Start with `README.md` network notes.
- Confirm server binds to `0.0.0.0` in `backend/server.js`.
- Check Windows Firewall for Node.js.
- Check LAN IP or `phuongnamcuti` host mapping.
- Try local desktop URL before phone URL.

## Wrong Layout On Port

- Start with `branch_server_map.md`.
- Verify the port is running from the correct checkout folder.
- Compare `http://localhost:<port>/app.js` length or hash across ports.
- If raw files match but UI differs by hostname, clear browser site data/cache.
- If prod `3002` shows dev-only code, stop it and restart from `C:\codelab\apps\TinyNewbornLogServers\prod`.

## Quick Tap Does Not Save

- Start with browser console and network request to POST `/api/logs`.
- Inspect `frontend/app.js` `createLog`.
- Inspect `backend/server.js` `buildLog` and `handlePostLog`.
- Check response status: `409` means paired activity conflict.
- Check write permission for `data/appData.json` and `data/recentInfo.json`.

## Sleep/Bath/Tummy Start-End Looks Wrong

- Start with `backend/server.js` `validatePairedTransition`.
- Compare frontend mirror in `frontend/app.js` `transitionConflict`.
- Inspect `logTime`, `isActiveAt`, `nextTimedStatus`.
- Check edited log date/time order.
- Check future-time rejection.

## Today Totals Are Wrong

- Start with `backend/server.js` `summarizeToday`.
- Compare frontend derived helpers in `frontend/app.js`.
- Inspect `date` fields in `data/appData.json`.
- Watch local timezone assumptions in `nowParts` and `todayBounds`.

## Recent Info Is Wrong

- Start with `data/recentInfo.json`.
- Inspect `backend/server.js` `updateRecent` and `rebuildRecent`.
- If after edit/delete, check that recent cache was rebuilt.
- If after new log, check returned `recent` payload.

## History Edit Fails

- Start with PUT `/api/logs/:id` network response.
- Inspect `frontend/app.js` `saveHistoryCorrection` or `saveActivityLogEdit`.
- Inspect `backend/server.js` `handleUpdateLog`.
- Check unsupported field edits by log type.
- Check paired-transition conflict message.

## Milestone Status Does Not Persist

- Start with `frontend/app.js` `updateMilestoneStatus`.
- Inspect API route `/api/milestones/:id`.
- Inspect `backend/server.js` `handleUpdateMilestone`.
- Check `data/appData.json` `milestone_progress`.
- Check status labels: `Not Yet`, `Maybe`, `Practicing`, `Confirmed`.

## Export Download Fails

- Start with network request to `/api/export/:format`.
- Inspect `backend/server.js` `handleExport`.
- Inspect `backend/exportService.js` range and save helpers.
- Check `backend/exports/` exists or can be created.
- Check `data/appData.json` has arrays expected by reports.

## Layout Or Mobile Bug

- Start with `frontend/index.html` section/dialog structure.
- Inspect targeted selectors in `frontend/styles.css`.
- Check media queries near the bottom of `frontend/styles.css`.
- Inspect render output in `frontend/app.js` for generated class names.

## Reminder Audio Bug

- Start with `frontend/app.js` sound toggle and speech helpers.
- Check browser permission/audio unlock behavior.
- Inspect localStorage keys for reminder interval and voice.
- Inspect `data/appData.json` `sound_settings` for shared toggle state.
