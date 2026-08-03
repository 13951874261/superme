# Dify 稳定入参缓存键对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 唤醒/破绽与长文的写入与读取均按 Dify 稳定入参签名精确命中；去掉宽兜底与「每天一行覆盖」。

**Architecture:** `daily_packs` 按 `(user_id, pack_date, input_signature)` upsert/读；长文增加 L1 七元组签名并精确查询；前端统一 `buildDailyPackQueryInput`。

**Tech Stack:** Node.js (vocab-server)、better-sqlite3、React 前端、现有 `scripts/test-*.js`

**Spec:** `docs/superpowers/specs/2026-08-03-dify-input-cache-key-align-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `vocab-server/services/dailyPackService.js` | Pack signature upsert/read；落库 theme=入参 |
| `vocab-server/server.js` | today 按签名读；listen/extract 签名读写 |
| `vocab-server/services/dailyListenPreGenerateService.js` | L1 签名写入；删除忽略 theme 兜底 |
| `src/components/modules/DailyWakeupModule.tsx` | mount 用 buildDailyPackQueryInput |
| `vocab-server/scripts/test-dify-cache-key-align.js` | 新测试 |

---

### Task 1: Pack upsert/read by signature

**Files:**
- Modify: `vocab-server/services/dailyPackService.js`
- Test: `vocab-server/scripts/test-dify-cache-key-align.js`
- Modify: `vocab-server/server.js` (`GET /api/daily-pack/today`)

- [ ] **Step 1: Write failing tests** for: (a) same user+date different theme → two rows; (b) today read with matching signature hits; (c) wrong theme → missing; (d) stored theme equals request theme not wakeup.theme

- [ ] **Step 2: Change `upsertDailyPack`** to find by `user_id + pack_date + input_signature` (not `findUserDailyPackByDate` alone)

- [ ] **Step 3: Change `generateDailyPackForUser`** final upsert to `theme` = request theme (not `wakeup.theme || theme`)

- [ ] **Step 4: Change today handler** to `computeInputSignature` from query then `getDailyPackRow(db, u, packDate, signature)`

- [ ] **Step 5: Run `node scripts/test-dify-cache-key-align.js`

---

### Task 2: Frontend wakeup read params

**Files:**
- Modify: `src/components/modules/DailyWakeupModule.tsx`

- [ ] **Step 1:** `loadTodayPack` / mount 改为 `await buildDailyPackQueryInput(theme)` 再 `getTodayDailyPack`

- [ ] **Step 2:** 确认与 `DailyErrorVocabularyModule` 同一入参来源

---

### Task 3: Listen L1 signature + remove wide fallback

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`
- Modify: `vocab-server/services/dailyPackService.js` (add `computeListenArticleInputSignature`)
- Modify: `vocab-server/server.js` (extract get/save paths)
- Test: extend `test-dify-cache-key-align.js`

- [ ] **Step 1:** Add `computeListenArticleInputSignature({ theme, genre, cefrLevel, duration, historyExclude, userFlaws, userCurrentProfile })`

- [ ] **Step 2:** On listen article/audio upsert, store signature; UNIQUE lookup includes signature (migrate column if needed; keep theme/genre/cefr/duration columns)

- [ ] **Step 3:** Remove theme-ignoring fallbacks in `getArticleRow` / `getAudioRow` (and extracted wide match that ignores theme)

- [ ] **Step 4:** Tests: matching L1 hit; theme mismatch miss; no fallback to other theme

- [ ] **Step 5:** Cron/generate paths pass history/flaws/profile when computing signature (same sources as extract when available; empty string if unavailable but must be consistent on read)

---

### Task 4: Verify N1 + pack contract tests

- [ ] Run `node scripts/test-login-ping-contract.js`
- [ ] Run `node scripts/test-dify-cache-key-align.js`
- [ ] Fix any broken daily-pack upsert isolation tests

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| D1 pack key | Task 1 |
| F1 salt not in key | already true if signature uses user theme; verify in Task 1 |
| theme column = request | Task 1 Step 3 |
| today exact read | Task 1 Step 4 |
| frontend unify | Task 2 |
| L1 listen key | Task 3 |
| remove wide fallback | Task 3 Step 3 |
| N1 unchanged | Task 4 |

---

**Execution:** 用户已回复「继续」→ 本会话 **Inline Execution** 推进。
