# Phuong Nam Logbook

A lightweight local web app for logging baby Phuong Nam's 0-2 month activities from phones, tablets, and laptops on the home network.

The MVP uses:

- Web frontend: static HTML, CSS, and JavaScript
- Backend: Node.js built-in `http` server
- Native app: SwiftUI iPhone companion and Apple Watch app in `ios/`
- Local data: JSON files in `data/`
- Windows launcher: `start.bat`

No npm packages are required.

## Run During Development

From this folder:

```bash
npm start
```

Or on Windows:

```bat
start.bat
```

Then open:

```text
http://localhost:3002
```

## Real Data vs Development Data

The app can run against separate JSON data folders so development work does not touch real baby logs.

Runtime data lives outside the code repo:

```text
C:\codelab\databases\TinyNewbornLog
├── dev
├── staging
├── prod
├── backups
└── shared
```

Environment purpose:

```text
dev      = fake/development data for building features
staging  = sanitized real-shaped data for final release testing
prod     = actual daily baby logs
shared   = care guidance and app rules used by all environments
backups  = automatic safety copies
```

Development workflow:

```bash
npm run start:dev
```

This starts the app on:

```text
http://localhost:3003
```

and reads/writes dev data from:

```text
C:\codelab\databases\TinyNewbornLog\dev
```

Release testing workflow:

```bash
npm run data:refresh-stage
npm run start:stage
```

This starts the app on:

```text
http://localhost:3004
```

and reads/writes staging data from:

```text
C:\codelab\databases\TinyNewbornLog\staging
```

`data:refresh-stage` rebuilds staging from prod data while sanitizing profile names, notes, comments, descriptions, details, and contact-like fields. It keeps the production-like shape, dates, log counts, and numeric values so release testing is realistic without exposing private notes directly.

For production daily use:

```bash
npm run start:prod
```

This starts the app on:

```text
http://localhost:3002
```

and reads/writes prod data from:

```text
C:\codelab\databases\TinyNewbornLog\prod
```

Shared reference files such as `doctor_guideline.json`, `doctor_guideline.md`, `activity_config.json`, and `poop-colors.json` live in:

```text
C:\codelab\databases\TinyNewbornLog\shared
```

Treat those as deliberate app knowledge/config, not per-environment activity logs.

You can still use the snapshot/switch helper when needed:

```bash
npm run data:list
npm run data:snapshot -- prod
npm run data:dev
npm run data:stage
npm run data:prod
```

Prefer `start:dev` for coding and UI testing, `start:stage` for pre-release checks, and `start:prod` only for actual family use.

## Code Environments

For industry-style code separation, this machine has three app folders:

```text
C:\codelab\apps\TinyNewbornLog-dev
C:\codelab\apps\TinyNewbornLog-staging
C:\codelab\apps\TinyNewbornLog-prod
```

Use them like this:

```text
TinyNewbornLog-dev
  Experimental code
  Runs dev data on http://localhost:3003

TinyNewbornLog-staging
  Release-candidate code
  Runs sanitized staging data on http://localhost:3004

TinyNewbornLog-prod
  Accepted stable code
  Runs prod data on http://localhost:3002
```

Each folder includes `start-this-environment.bat` for the matching environment. Production should stay online from the prod folder. Dev and staging can be started only when needed.

When Git is available, prefer promoting code by merging branches/worktrees:

```text
dev -> staging -> main/prod
```

Until then, treat folder copying as a manual promotion step and avoid editing the prod folder directly.

## Run Apple Watch App

Open this project in Xcode:

```text
ios/TinyNewbornLog.xcodeproj
```

For a real Apple Watch, select the `TinyNewbornLog iPhone App` scheme and choose the paired iPhone as the run destination. Xcode installs the Watch app through the iPhone.

The Watch app syncs logs to the local web server endpoint:

```text
http://192.168.86.55:3002/api/logs
```

The project standard port is 3002:

```bash
node backend/server.js 3002
```

or:

```bat
set PORT=3002
start.bat
```

## Home Network Access

The server binds to `0.0.0.0`, so other devices on the same network can open it with the desktop's LAN IP, for example:

```text
http://192.168.1.25:3002
```

Allow Node.js through Windows Firewall if another device cannot connect.

Current home-network development address we are using right now:

```text
http://192.168.86.55:3002/
```

This is a local convenience note for the current setup, not a production deployment pattern.

If the page stays on `Loading profile...`, check these endpoints from the desktop:

```text
http://127.0.0.1:3002/api/app-data
http://127.0.0.1:3002/api/recent
http://127.0.0.1:3002/api/today-summary
```

All three should return JSON. If they do, hard-refresh the phone/browser page so it fetches the latest `/app.js` cache-busted script.

## Overview Review Guidance

The dashboard Overview review reads local JSON data from `data/`:

- `app_data.json`: baby profile, recent state, and Overview settings
- `baby_log.json`: activity logs
- `milestone_log.json`: milestone progress/history
- `doctor_guideline.json`: parent-maintained pediatrician guidance, trusted source catalog, source-backed rules, and citation links
- `doctor_guideline.md`: GPT-readable care knowledgebase generated from the guideline JSON, with trusted links and less JSON boilerplate
- `poop-colors.json`: stool color categories and parent actions

`appData.json` is legacy and should not be used for new Overview logic.

Overview review modes:

- `Fast local rules`: no paid API call; uses deterministic local rules and refreshes automatically.
- `Strict Ollama`: uses local Ollama and the strict JSON safety validator.
- `Strict GPT`: uses OpenAI only when Refresh is pressed, so it does not spend money in the background.

Overview voice can be changed in Settings:

- `Calm parent-friendly`: simple and practical.
- `Pediatrician, Gen Z-professional`: cautious pediatrician-style language that is warm, concise, and lightly modern without changing the medical safety rules.

Strict GPT receives the full `doctor_guideline.md` knowledgebase plus the structured logs/metrics so it can write a richer parent review. Strict Ollama and fast local rules stay lighter. The Overview output is organized into Overall plus seven short categories: Eat, Sleep, Hygiene / Diaper, Health, Safety, Exercise, and Play. Cards can show `Sources` links from trusted guideline sources. The app rejects review output that diagnoses, makes unsupported trouble claims, gives unsafe sleep advice, recommends medication dosing, or gives emergency advice without a matching urgent rule flag.

## Friendly Local Name

This desktop is configured to resolve:

```text
phuongnamcuti -> 192.168.86.55
```

Run the friendly-name local version with:

```bat
start-phuongnamcuti.bat
```

Then open:

```text
http://phuongnamcuti:3002
```

For other phones, tablets, and laptops, add the same DNS/host mapping in your router or on each device:

```text
phuongnamcuti -> 192.168.86.55
```

## Reverse Proxy Ready

The frontend uses relative API paths only:

- `GET /api/logs`
- `POST /api/logs`
- `GET /api/recent`
- `GET /api/today-summary`
- `GET /api/app-data`
- `GET /api/export/...`

That keeps the app compatible with a friendly reverse-proxy URL such as:

```text
http://phuongnam.local
```

Example Caddy idea:

```caddyfile
phuongnam.local {
  reverse_proxy 127.0.0.1:3002
}
```

Example Nginx idea:

```nginx
server {
  server_name phuongnam.local;

  location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Data Files

- `data/app_data.json`: baby profile, recent UI state, sound settings, goals, schedule templates, and other app-level data
- `data/baby_log.json`: activity log entries such as sleep, feeding, bottles, diapers, bath, tummy time, outdoor time, growth stats, and gym time
- `data/milestone_log.json`: milestone history and parent-entered milestone progress
- `data/doctor_guideline.json`: parent-maintained knowledgebase for pediatrician recommendations, feeding guidance, sleep guidance, milestone guidance, exercise guidance, and care-sheet red flags
- `data/activity_config.json`: backend activity rules, including which activities are quick logs and which have start/stop pairs
- `data/poop-colors.json`: poop color meanings and parent actions

Legacy files:

- `data/appData.json`: old monolithic database. Kept as a migration source and backup.
- `data/recentInfo.json`: old recent-state file. Kept as a migration source and backup.

The backend storage layer is `backend/dataStore.js`. It presents a combined app-data shape to existing API handlers while reading and writing the split JSON files above. If a split file is missing, `dataStore.js` can recreate it from the legacy files.

Each quick tap appends a log entry to `data/baby_log.json`. Bottle amount, next breast side, and recent activity reminders update `recent_state` inside `data/app_data.json`.

The Care tab, Milestones tab, and assistant endpoints read medical/care/development guidance from `data/doctor_guideline.json`. The old `frontend/data/care` JSON files were merged into `doctor_guideline.careGuides`, and hardcoded milestone definitions were moved into `doctor_guideline.milestoneGuide`.

Treat `data/doctor_guideline.json` as the parent-maintained knowledgebase. Update it deliberately when adding doctor guidance, care guidance, or milestone guidance; progress/status logs belong in `data/milestone_log.json`.

To add pediatrician guidance later, edit `data/doctor_guideline.json` and add an object to `recommendations`, for example:

```json
{
  "id": "doctor-note-fever",
  "source": "pediatrician",
  "category": "sick",
  "urgency": "call",
  "summary": "Call for fever or parent concern.",
  "action": "Follow the pediatrician's fever plan."
}
```

Keep medical entries specific to guidance you received or clearly sourced care-sheet red flags. The app should not invent doctor recommendations.

## Overview Review System

Home > Dashboard uses `/api/dashboard-overview` to build a parent-friendly review from the split JSON sources. It does not use legacy `data/appData.json`.

Overview source flow:

- `loadOverviewSources()`: reads `app_data.json`, `baby_log.json`, `doctor_guideline.json`, `poop-colors.json`, `milestone_log.json`, and `activity_config.json`
- `buildOverviewMetrics()`: summarizes recent activity, period durations, stool color state, growth, and milestone progress
- `runOverviewRules()`: produces a safe local review from rules and guidance
- `buildLlamaOverviewInput()` and `runLlamaOverviewReview()`: ask local Llama for a parent-friendly rewrite
- `validateOverviewReview()` and `publishOverviewReviewAtomically()`: validate the review shape before returning it to the frontend

The frontend keeps `publishedReview` visible while a new `pendingReview` runs in the background. Auto-review runs once on app start, then every 5 minutes, and the Dashboard Refresh button forces a review unless one is already running.

Llama must return the cautious overview schema with `reviewStatus: "ready"`, `overall`, 5-9 cards from `safety` through `parent_next_steps`, exact approved recommendation text, and review metadata. If parsing or validation fails, the server returns the fallback refresh error and the frontend keeps the previous cached review.

Overview settings are stored in `data/app_data.json` under `overview_settings` and can be changed from the Settings tab. The default review mode is `rules_only`, which publishes a safe local review immediately and avoids waiting on CPU-only Llama. Switch to `ollama_strict` when you want to test local Ollama generation; `maxOutputTokens` maps to Ollama `num_predict`.

To use GPT for Overview, choose `Strict GPT` in Settings. GPT reviews are manual-only: they run when you press Refresh, not on the auto-refresh timer. The app calls the OpenAI Responses API directly.

The server reads the OpenAI key from this external local file by default:

```text
C:\codelab\key\keys.json
```

Expected shape:

```json
{
  "api_keys": {
    "open_ai": "your_key_here"
  }
}
```

You can override the key with `OPENAI_API_KEY`, or point to a different key file with `API_KEYS_FILE`. Optional environment variables:

```bat
set OPENAI_API_KEY=your_key_here
set API_KEYS_FILE=C:\codelab\key\keys.json
set OPENAI_MODEL=gpt-4.1-mini
set OPENAI_OVERVIEW_TIMEOUT_MS=45000
```

## Backend Structure

- `backend/server.js`: HTTP routing, validation, activity log operations, assistant endpoints, and static file serving
- `backend/dataStore.js`: JSON storage layout, legacy migration, and compatibility helpers
- `backend/exportService.js`: report building and file export generation

## Logging API

Create a log:

```http
POST /api/logs
Content-Type: application/json
```

Examples:

```json
{ "type": "sleep", "status": "asleep" }
```

```json
{ "type": "feeding", "method": "breast", "side": "left" }
```

```json
{ "type": "bottle", "ounces": 3.25 }
```

```json
{ "type": "diaper", "kind": "pee" }
```

```json
{ "type": "tummy_time", "status": "start" }
```

## Exporting Data

The Export tab supports:

- PDF report
- Pediatrician PDF
- Excel / XLSX
- CSV raw logs
- JSON backup

Generated exports are saved in:

```text
backend/exports/
```
