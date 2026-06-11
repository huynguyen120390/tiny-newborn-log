When to read this file:
Read this before changing branches, starting/stopping servers, debugging port differences, or promoting code between dev/staging/main/prod.

# Branch And Server Map

## Golden Rule

Each public server port must run from its own checkout folder. Do not run production from the active development checkout.

Code branch and data mode are separate:

- Code branch decides which UI/backend files are served.
- Data mode decides which JSON database folder is used.

## Working Repo

Primary development repo:

```text
C:\Users\Huy\Documents\TinyNewbornLog
```

Use this folder for normal Codex code edits, commits, and pushes. It is usually on `dev`.

## Server Checkouts

Dedicated runtime checkouts:

```text
C:\codelab\apps\TinyNewbornLogServers\dev
C:\codelab\apps\TinyNewbornLogServers\staging
C:\codelab\apps\TinyNewbornLogServers\main
C:\codelab\apps\TinyNewbornLogServers\prod
```

These folders isolate running servers from the active editing repo.

## Sync Rule

When code changes are made in the primary development repo, sync the matching runtime checkout before verifying a server:

```text
C:\Users\Huy\Documents\TinyNewbornLog -> C:\codelab\apps\TinyNewbornLogServers\dev
```

Normal flow:

```text
edit/commit/push dev in Documents repo
pull origin/dev in C:\codelab\apps\TinyNewbornLogServers\dev
restart or verify dev server on port 3003
```

Only sync staging/main/prod runtime checkouts after their matching branches are intentionally updated.

## Ports

| Server | URL | Branch | Data mode | Database folder |
| --- | --- | --- | --- | --- |
| main | `http://localhost:3001` | `main` | `staging` | `C:\codelab\databases\TinyNewbornLog\staging` |
| prod | `http://localhost:3002` | `prod` | `prod` | `C:\codelab\databases\TinyNewbornLog\prod` |
| dev | `http://localhost:3003` | `dev` | `dev` | `C:\codelab\databases\TinyNewbornLog\dev` |
| staging | `http://localhost:3004` | `staging` | `staging` | `C:\codelab\databases\TinyNewbornLog\staging` |
| server control | `http://localhost:3010` | runs from dev checkout | n/a | n/a |

LAN/Tailscale access uses the same ports with the host IP, for example:

```text
http://192.168.0.13:3002
http://100.100.187.79:3002
```

## Database Root

Runtime data lives outside the code repo:

```text
C:\codelab\databases\TinyNewbornLog
```

Common subfolders:

```text
C:\codelab\databases\TinyNewbornLog\dev
C:\codelab\databases\TinyNewbornLog\staging
C:\codelab\databases\TinyNewbornLog\prod
C:\codelab\databases\TinyNewbornLog\shared
C:\codelab\databases\TinyNewbornLog\backups
```

## Start Rules

- Dev server `3003` must start from `C:\codelab\apps\TinyNewbornLogServers\dev`.
- Staging server `3004` must start from `C:\codelab\apps\TinyNewbornLogServers\staging`.
- Main server `3001` must start from `C:\codelab\apps\TinyNewbornLogServers\main`.
- Production server `3002` must start from `C:\codelab\apps\TinyNewbornLogServers\prod`.
- Server Control `3010` should start from `C:\codelab\apps\TinyNewbornLogServers\dev`.

`scripts/ops-server.js` knows these runtime roots. If paths change, update that file or set:

```text
APP_ROOT_BASE
APP_ROOT_DEV
APP_ROOT_STAGING
APP_ROOT_MAIN
APP_ROOT_PROD
```

## Promotion Rule

New feature work should appear first on:

```text
dev branch -> dev server -> port 3003
```

Production should change only after code is intentionally merged or promoted to:

```text
prod branch -> prod server -> port 3002
```

If `3002` shows uncommitted dev changes, production is running from the wrong folder.

## Full Deployment From Dev

When Huy says "full deployment from dev", do this exact promotion flow:

```text
dev -> staging -> main -> prod
```

Required sequence:

1. Start in `C:\Users\Huy\Documents\TinyNewbornLog` and confirm the working tree is clean.
2. Fetch from `origin`.
3. Merge `dev` into `staging`, then push `staging`.
4. Merge `staging` into `main`, then push `main`.
5. Merge `main` into `prod`, then push `prod`.
6. Return to `dev`.
7. Pull each dedicated runtime checkout from its matching branch:

```text
C:\codelab\apps\TinyNewbornLogServers\dev      <- origin/dev
C:\codelab\apps\TinyNewbornLogServers\staging  <- origin/staging
C:\codelab\apps\TinyNewbornLogServers\main     <- origin/main
C:\codelab\apps\TinyNewbornLogServers\prod     <- origin/prod
```

8. Restart all app servers and Server Control from their dedicated runtime folders.
9. Verify ports `3001`, `3002`, `3003`, `3004`, and `3010` are listening.

Do not use the active Documents repo as a runtime server root during deployment.

## Verification Commands

Check live ports:

```powershell
netstat -ano | Select-String -Pattern ':(3001|3002|3003|3004|3010)\s'
```

Check Server Control:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3010/api/server-control/status'
```

Check code separation by app bundle:

```powershell
foreach ($port in 3001,3002,3003,3004) {
  $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/app.js"
  "$port length=$($r.Content.Length)"
}
```

If only dev contains a new symbol or changed bundle length, isolation is working.

## Cache Notes

If two hostnames show different UI for the same port but raw `app.js` hashes match, suspect browser cache or local site data.

Examples:

```text
http://localhost:3002
http://192.168.0.13:3002
http://100.100.187.79:3002
```

The server sends `Cache-Control: no-store` for `.html`, `.css`, and `.js`, but mobile browsers may still need site data cleared.
