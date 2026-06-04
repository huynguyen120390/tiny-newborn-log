# Phuong Nam Logbook

A lightweight local web app for logging baby Phuong Nam's 0-2 month activities from phones, tablets, and laptops on the home network.

The MVP uses:

- Web frontend: static HTML, CSS, and JavaScript
- Backend: Node.js built-in `http` server
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

To use GPT for Overview, set `OPENAI_API_KEY` in the server environment and choose `Strict GPT` in Settings. GPT reviews are manual-only: they run when you press Refresh, not on the auto-refresh timer. The app calls the OpenAI Responses API directly and does not save the API key in JSON. Optional environment variables:

```bat
set OPENAI_API_KEY=your_key_here
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
