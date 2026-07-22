# Ultragoal Brief — webpage-purify-500

Source: `.omx/specs/deep-interview-webpage-purify-500.md`

## Objective
Restore production webpage extract preview on `app.liujingzhuwo.site` so `POST /api/materials/fetch-url` returns `success: true` with non-empty markdown (current failure: `{"success":false,"error":"fetch failed"}`).

## Constraints / Non-goals
- Diagnose on production first (SSH/curl/logs allowed), then fix+deploy autonomously.
- Do not change UI layout/copy, material pipeline, fetch product architecture, content-quality tuning, or API key governance.
- May decide proxy/env, FETCH_ENDPOINT/timeouts/retries, webFetcher/error wrapping, deploy+restart without re-asking.

## Acceptance
1. Production-side evidence ties root cause to `fetch failed`.
2. `POST https://app.liujingzhuwo.site/api/materials/fetch-url` with `https://example.com` → success + non-empty markdown.
3. Browser preview no longer shows this 500/`fetch failed`.
