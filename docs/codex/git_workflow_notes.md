When to read this file:
Read this before committing, pushing, merging branches, or syncing runtime checkouts.

# Git Workflow Notes

## Default Branch

When Huy asks for a code update and does not name a branch, work in:

```text
dev
```

Primary editing repo:

```text
C:\Users\Huy\Documents\TinyNewbornLog
```

## Commit And Push Flow

For ordinary dev changes:

1. Confirm the current branch is `dev`.
2. Check status and diff before staging.
3. Stage only files that belong to the requested task.
4. Commit with a concise imperative message.
5. Push `dev` to `origin`.
6. Sync the dev runtime checkout in `C:\codelab`.
7. Restart the dev server on port `3003`.
8. Verify `3003` is listening and serving the changed files.

Commands commonly used:

```powershell
git status --short --branch
git diff --stat
git add -- <files>
git commit -m "<message>"
git push origin dev
git -C C:\codelab\apps\TinyNewbornLogServers\dev pull --ff-only origin dev
```

## Dev Runtime Restart

The dev server must run from:

```text
C:\codelab\apps\TinyNewbornLogServers\dev
```

After syncing that checkout, restart port `3003` from that folder. If `3003` is already occupied, identify and stop only the old `3003` server process.

Start command pattern:

```powershell
$node='C:\Users\Huy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$devDir='C:\codelab\apps\TinyNewbornLogServers\dev'
Start-Process -FilePath $node -ArgumentList @('scripts/start-mode.js','dev','3003') -WorkingDirectory $devDir -RedirectStandardOutput (Join-Path $devDir 'dev-server.out.log') -RedirectStandardError (Join-Path $devDir 'dev-server.err.log') -WindowStyle Hidden
```

## GitHub Tooling Experience

`git` is available on PATH.

`gh` has not been available on PATH in recent sessions, so use plain `git` for commits, fetches, merges, and pushes. Do not depend on GitHub CLI commands unless `Get-Command gh` succeeds first.

This repository is allowed for authenticated Git operations by Huy's local repo policy:

```text
https://github.com/huynguyen120390/tiny-newborn-log.git
```

Plain `git push origin dev` has worked with the existing credential setup.

## Dirty Worktree Rule

The worktree may contain unrelated user changes. Do not revert them.

If unrelated files are dirty, leave them alone and stage only the files needed for the current task.

If dirty files overlap the requested change, inspect them carefully and work with the existing edits instead of discarding them.

## Branch Promotion

For "full deployment from dev", use `branch_server_map.md`.

Do not merge to `staging`, `main`, or `prod` unless Huy explicitly asks for deployment or branch sync.
