# Deep Interview Spec: web-fetch-still-invalid-token

## Root Cause (confirmed)
1. Local `webFetcher.js` was fixed and works (`fetchUrlContent` OK).
2. Production still throws `Invalid or unexpected token` because the fixed file was **never uploaded**.
3. `deploy-smart.ps1 -BackendOnly` previously **skipped git change scan**, so `$changedFiles` was empty and Step 3 defaulted to uploading **only** `server.js`.

## Fixes applied (local)
- `deploy-smart.ps1`: always scan changed files; `-BackendOnly` uploads all `vocab-server/` changes (fallback includes `webFetcher.js`).
- `scripts/deploy-webfetcher-putty.ps1`: dedicated PuTTY upload + remote `node --check` + fetch-url verify.

## Remaining action (requires SSH password)
Run:
```powershell
$env:DEPLOY_SSH_PW = 'your-password'
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\cursor\work\super-agent\scripts\deploy-webfetcher-putty.ps1"
```
