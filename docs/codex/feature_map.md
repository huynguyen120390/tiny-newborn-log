When to read this file:
Read this when changing or debugging a user-facing feature.

# Feature Map

## Shell And Navigation

- `frontend/index.html`: defines Log, Today, History, Export, Milestones, Settings tabs.
- `frontend/app.js`: `activateTab`, `renderAll`, and startup flow.
- `frontend/styles.css`: tab, panel, mobile layout, modal, toast, reaction styles.

## Activity Logging

- `frontend/app.js`: `activities` config and `renderActivities` build log cards.
- `frontend/app.js`: `createLog` posts quick taps to the backend.
- `frontend/app.js`: `openBottleDialog` and bottle form handle bottle amount.
- `backend/server.js`: `buildLog`, `handlePostLog`, `updateRecent` persist logs.

## Timed Activities

- `frontend/app.js`: sleep, bath, tummy time buttons use paired start/end logic.
- `frontend/app.js`: `transitionConflict` mirrors backend overlap checks.
- `backend/server.js`: `validatePairedTransition` is the source of API conflict errors.

## Recent And Today Views

- `frontend/app.js`: `refreshData` loads app data, recent state, and today summary.
- `frontend/app.js`: `renderTodaySummary`, `renderRecent`, `renderActivityStats` update views.
- `backend/server.js`: `summarizeToday` computes API totals.
- `data/recentInfo.json`: stores last activity/feed/sleep/diaper and defaults.

## History And Corrections

- `frontend/app.js`: `renderHistory` lists newest logs first.
- `frontend/app.js`: `saveHistoryCorrection` updates existing logs.
- `frontend/app.js`: `openActivityLogs` edits logs from activity cards.
- `backend/server.js`: `handleUpdateLog` validates and saves edits.

## Milestones And Exercises

- `frontend/app.js`: `milestoneDefinitions` defines milestone catalog.
- `frontend/app.js`: `exerciseLibrary` defines parent-guided exercises.
- `frontend/app.js`: `renderMilestones`, `openMilestoneDialog`, `updateMilestoneStatus`.
- `backend/server.js`: `handleUpdateMilestone` saves milestone progress.
- `frontend/icons/milestones/`: milestone image assets.

## Settings

- `frontend/app.js`: `setupSettingsPanel`, `renderSettings`, `saveProfile`.
- `frontend/app.js`: visible cards and reminder preferences use `localStorage`.
- `backend/server.js`: `handleUpdateProfile`, `handleUpdateSoundSettings`.

## Reminders And Audio

- `frontend/app.js`: bath and tummy reminders use speech synthesis and chime helpers.
- `frontend/app.js`: `toggleBathSound`, `toggleTummySound`, `saveSoundSettings`.
- `data/appData.json`: `sound_settings` persists shared sound toggles.

## Exports

- `frontend/app.js`: `setupExportPanel` submits export form and downloads files.
- `backend/server.js`: `handleExport` routes export endpoints.
- `backend/exportService.js`: builds reports and saves JSON, CSV, PDF, XLSX.

## Assets And Utilities

- `frontend/assets/activity/`: activity card icons and headers.
- `frontend/assets/`: baby spirit images.
- `scripts/crop_milestone_icons.py`: crops milestone icons from a local source sheet.
