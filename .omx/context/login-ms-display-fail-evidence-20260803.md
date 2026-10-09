# Evidence intake: login-ms-display-fail (2026-08-03)

## Prod curl (B)
- URL: `GET /api/daily-pack/today?userId=lzhmy&theme=商务谈判：让步与施压`
- Result: `http=200 time=0.002846s`
- Body head: `status=ready`, `theme=商务沟通` (pack theme ≠ query theme), wakeup vocab present

## Prod sqlite (B)
- `lzhmy|2026-08-03|ready|wakeup_len=1870|flaw_len=1031|updated=2026-08-03 20:02:18`
- No lzhumy row for today in result

## Browser Network (C) — screenshot
- Two `today?userId=lzhmy&theme...` fetch requests
- Both Status **200**
- Times: **273 ms** and **135 ms** (under 5s Abort)
- Size ~3.9 kB each
- Same initiator `index-D8HiDD8X.js:615` (dual mount / dual module fetch)
- Follow-up UI: wakeup cards + flaw vocab visible

## Draft implication (pending user confirm)
- Server-local today NOT slow; ready pack EXISTS
- Current browser path NOT timing out
- Earlier UI timeout (>5s) NOT reproduced now → intermittent/historical unless more captures
- Dual today requests confirmed but not causing >5s in this capture
