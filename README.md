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
http://localhost:3000
```

To use another port:

```bash
node backend/server.js 3001
```

or:

```bat
set PORT=3001
start.bat
```

## Home Network Access

The server binds to `0.0.0.0`, so other devices on the same network can open it with the desktop's LAN IP, for example:

```text
http://192.168.1.25:3000
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

## Friendly Local Name

This desktop is configured to resolve:

```text
phuongnamcuti -> 192.168.86.55
```

Run the no-port local version with:

```bat
start-phuongnamcuti.bat
```

Then open:

```text
http://phuongnamcuti
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
  reverse_proxy 127.0.0.1:3000
}
```

Example Nginx idea:

```nginx
server {
  server_name phuongnam.local;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Data Files

- `data/appData.json`: main baby profile and log database
- `data/recentInfo.json`: recent UI defaults such as the last bottle amount and next breast side

Each quick tap appends a log entry to `appData.json`. Bottle amount and breast-side reminders update `recentInfo.json`.

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
