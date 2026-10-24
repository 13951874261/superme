# 每日主题单词减量与专业口径 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每日唤醒最多推 5 词（3 个当前主题专业术语 + 2 个博弈/逻辑词），词形与跨模块去重，不够不凑旧词；破绽模块保持 6 词与补齐。

**Architecture:** 在现有 `generateVocabWithDedupe` 上增加 `allowBackfill` / 词形键 / 当日长文·精听排除；唤醒路径再做普通词拒绝与 3+2 槽位挑选。Dify 唤醒 YAML 改口径。前端只改标题与少推提示，不改布局。

**Tech Stack:** Node.js 20 + better-sqlite3（vocab-server）；React + Vite（前端）；Dify `english_wakeup_routine`

**Design spec:** `docs/superpowers/specs/2026-08-31-daily-theme-vocab-quality-design.md`

**约束：** 不自动 `git commit`，除非用户明确要求。一次只落地并验证一个功能后再进入下一个。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/dailyPackService.js` | stem、词库、3+2 挑选、当日兄弟模块排除、唤醒关补齐、目标数 5 |
| `vocab-server/tests/vocabStem.test.js` | 词形归一单测 |
| `vocab-server/tests/wakeupSlotPick.test.js` | 3+2 / 普通词拒绝单测 |
| `vocab-server/tests/sameDaySiblingExclude.test.js` | 当日长文/精听排除单测 |
| `vocab-server/tests/vocabDedupePipeline.test.js` | 改唤醒期望：≤5、不补齐；破绽仍 6 |
| `yml/time_base/english_wakeup_routine.yml` | Prompt：最多 5 = 3+2，禁止高频普通词 |
| `src/components/modules/DailyWakeupModule.tsx` | 标题 + 展示 `_dedupeNotice` |
| `src/services/dailyPackAPI.ts` | `WakeupPayload` 增加可选 `_dedupeNotice` |
| `vocab-server/tests/dailyPackTodaySla.test.js` | 标题不再写「10 个高频词」 |

不改：`DailyErrorVocabularyModule.tsx`、长文/精听生成、`input_signature`、`/api/daily-pack/today` 读缓存契约。

---

### Task 1: 词形归一（功能 1）

**Files:**
- Create: `vocab-server/tests/vocabStem.test.js`
- Modify: `vocab-server/services/dailyPackService.js`（`normalizePushedWord` 旁新增函数并导出）

- [ ] **Step 1: 先写失败测试**

```javascript
const assert = require('assert');
const { stemWordKey } = require('../services/dailyPackService');

function same(a, b) {
  assert.strictEqual(stemWordKey(a), stemWordKey(b), `${a} 与 ${b} 必须同一词根`);
}

function testStemPairs() {
  same('model', 'modeling');
  same('model', 'modelling');
  same('model', 'models');
  same('MODELING', 'modelling');
  same('negotiate', 'negotiation');
  same('negotiate', 'negotiating');
  same("prisoner's dilemma", 'prisoners dilemma');
  same('prisoner', 'prisoners');
  same('discuss', 'discussion');
  assert.notStrictEqual(stemWordKey('leverage'), stemWordKey('advantage'));
  console.log('PASS vocabStem');
}

testStemPairs();
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node vocab-server/tests/vocabStem.test.js`

Expected: `stemWordKey` 未导出或配对不相等。

- [ ] **Step 3: 最小实现**

在 `dailyPackService.js` 的 `normalizePushedWord` 旁加入：

```javascript
function normalizePushedWord(raw) {
  return String(raw || '').toLowerCase().trim();
}

function normalizeWordSurface(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function stemToken(token) {
  let t = String(token || '').toLowerCase();
  if (t.length <= 3) return t;
  if (t.endsWith('lling')) return `${t.slice(0, -5)}l`;
  if (t.endsWith('ssion')) return t.slice(0, -3);
  const suffixes = [
    'ational', 'tional', 'ation', 'ition', 'ings', 'ating', 'ated', 'ate',
    'tion', 'sion', 'ing', 'ies', 'es', 'ed', 's',
  ];
  for (const suf of suffixes) {
    if (t.length - suf.length >= 3 && t.endsWith(suf)) {
      if (suf === 's' && t.endsWith('ss')) continue;
      return t.slice(0, -suf.length);
    }
  }
  return t;
}

function stemWordKey(raw) {
  const surface = normalizeWordSurface(raw);
  if (!surface) return '';
  return surface.split(' ').map(stemToken).filter(Boolean).join(' ');
}

function stemsMatch(a, b) {
  const sa = stemWordKey(a);
  const sb = stemWordKey(b);
  return Boolean(sa && sb && sa === sb);
}
```

`module.exports` 增加：`stemWordKey`, `normalizeWordSurface`, `stemsMatch`。  
`normalizePushedWord` 保持原语义（历史表存小写原文），不要改成 stem。

- [ ] **Step 4: 再跑测试，确认通过**

Run: `node vocab-server/tests/vocabStem.test.js`

Expected: `PASS vocabStem`

**功能 1 验收：** 上表成对词根相同；`leverage` ≠ `advantage`。通过后再进入 Task 2。

---

### Task 2: 3+2 挑选与普通词拒绝（功能 2）

**Files:**
- Create: `vocab-server/tests/wakeupSlotPick.test.js`
- Modify: `vocab-server/services/dailyPackService.js`

- [ ] **Step 1: 先写失败测试**

```javascript
const assert = require('assert');
const {
  pickWakeupSlots,
  isBannedGenericWord,
  THEORY_LEXICON,
} = require('../services/dailyPackService');

function w(word, slot) {
  return { word, ipa: '/x/', meaning_zh: word, pronunciation_note: 't', example: word, slot };
}

function testBan() {
  assert.ok(isBannedGenericWord('modeling'));
  assert.ok(isBannedGenericWord('modelling'));
  assert.ok(isBannedGenericWord('agenda'));
  assert.ok(isBannedGenericWord('deadline'));
  assert.ok(isBannedGenericWord('discussion'));
  assert.ok(!isBannedGenericWord("prisoner's dilemma"));
  console.log('  ban ok');
}

function testPick32() {
  const picked = pickWakeupSlots([
    w('modeling'),
    w('BATNA', 'theme'),
    w('reservation price', 'theme'),
    w('anchoring', 'theme'),
    w("prisoner's dilemma", 'theory'),
    w('Nash equilibrium', 'theory'),
    w('agenda'),
  ]);
  const names = picked.map((x) => x.word);
  assert.strictEqual(picked.length, 5);
  assert.deepStrictEqual(names.slice(0, 3), ['BATNA', 'reservation price', 'anchoring']);
  assert.deepStrictEqual(names.slice(3), ["prisoner's dilemma", 'Nash equilibrium']);
  assert.ok(!names.includes('modeling') && !names.includes('agenda'));
  console.log('  pick 3+2 ok');
}

function testLexiconFallbackSlot() {
  const picked = pickWakeupSlots([
    w('zero-sum'),
    w('butterfly effect'),
    w('custom term A'),
    w('custom term B'),
    w('custom term C'),
  ]);
  const names = picked.map((x) => x.word);
  assert.strictEqual(names.filter((n) => n.startsWith('custom')).length, 3);
  assert.ok(names.includes('zero-sum'));
  assert.ok(names.includes('butterfly effect'));
  assert.ok(THEORY_LEXICON.some((t) => t.includes('butterfly')));
  console.log('  lexicon fallback ok');
}

function testNoDoubleSlot() {
  const picked = pickWakeupSlots([
    w('BATNA', 'theme'),
    w('term-a', 'theme'),
    w('term-b', 'theme'),
    w('BATNA', 'theory'),
    w('Nash equilibrium', 'theory'),
  ]);
  assert.strictEqual(picked.filter((x) => /batna/i.test(x.word)).length, 1);
  console.log('  no double slot ok');
}

testBan();
testPick32();
testLexiconFallbackSlot();
testNoDoubleSlot();
console.log('PASS wakeupSlotPick');
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node vocab-server/tests/wakeupSlotPick.test.js`

Expected: `pickWakeupSlots` 未导出。

- [ ] **Step 3: 最小实现**

```javascript
const GENERIC_BAN_WORDS = [
  'model', 'modeling', 'modelling', 'agenda', 'deadline',
  'meeting', 'email', 'discuss', 'discussion',
];

const THEORY_LEXICON = [
  "prisoner's dilemma", 'Nash equilibrium', 'zero-sum', 'butterfly effect',
  'information asymmetry', 'moral hazard', 'BATNA', 'coordination game',
  'dominant strategy', 'Pareto', 'anchoring', 'cobweb theorem',
  'zero-sum game', 'mixed strategy', 'cheap talk', 'signaling',
  'screening', 'tragedy of the commons', 'principal-agent',
  'bounded rationality', 'confirmation bias', 'false dilemma', 'slippery slope',
];

const DEDUPE_SHORT_NOTICE = '今日合格新词不足，已按不重复原则少推，未用旧词凑数。';

function isBannedGenericWord(word) {
  return GENERIC_BAN_WORDS.some((ban) => stemsMatch(word, ban));
}

function isTheoryLexiconWord(word) {
  return THEORY_LEXICON.some((term) => stemsMatch(word, term));
}

function resolveWakeupSlot(item) {
  const slot = String(item?.slot || '').trim();
  if (slot === 'theme' || slot === 'theory') return slot;
  return isTheoryLexiconWord(item?.word) ? 'theory' : 'theme';
}

function pickWakeupSlots(items) {
  const theme = [];
  const theory = [];
  const seen = new Set();
  for (const item of items || []) {
    const word = String(item?.word || '').trim();
    if (!word || isBannedGenericWord(word)) continue;
    const key = stemWordKey(word);
    if (!key || seen.has(key)) continue;
    const slot = resolveWakeupSlot(item);
    if (slot === 'theory') {
      if (theory.length >= 2) continue;
      theory.push(item);
    } else {
      if (theme.length >= 3) continue;
      theme.push(item);
    }
    seen.add(key);
  }
  return [...theme, ...theory];
}

function unusedTheoryHints(picked, limit = 6) {
  const have = new Set((picked || []).map((i) => stemWordKey(i.word)));
  return THEORY_LEXICON.filter((term) => !have.has(stemWordKey(term))).slice(0, limit);
}
```

导出：`GENERIC_BAN_WORDS`, `THEORY_LEXICON`, `DEDUPE_SHORT_NOTICE`, `isBannedGenericWord`, `isTheoryLexiconWord`, `pickWakeupSlots`, `unusedTheoryHints`。

- [ ] **Step 4: 再跑测试，确认通过**

Run: `node vocab-server/tests/wakeupSlotPick.test.js`

Expected: `PASS wakeupSlotPick`

**功能 2 验收：** 普通词被拒；输出顺序 3 主题 + 2 博弈；BATNA 不占两槽。通过后再进入 Task 3。

---

### Task 3: 当日长文/精听排除收集（功能 3）

**Files:**
- Create: `vocab-server/tests/sameDaySiblingExclude.test.js`
- Modify: `vocab-server/services/dailyPackService.js`

- [ ] **Step 1: 先写失败测试**

```javascript
const assert = require('assert');
const dailyPackService = require('../services/dailyPackService');

function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(':memory:');
  }
}

function testCollectsTodayOnly() {
  const db = openDatabase();
  dailyPackService.initDailyPackTables(db);
  const day = dailyPackService.getPackDate();
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_extracted_articles (
      id TEXT, user_id TEXT, quota_date TEXT, words_json TEXT, phrases_json TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_listen_articles (
      id TEXT, user_id TEXT, pack_date TEXT, vocab_json TEXT, phrases_json TEXT
    );
  `);
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a1', 'u1', day, JSON.stringify([{ word: 'butterfly effect' }]), JSON.stringify(['signaling']));
  db.prepare('INSERT INTO daily_listen_articles VALUES (?,?,?,?,?)')
    .run('l1', 'u1', day, JSON.stringify(['Nash equilibrium']), JSON.stringify([{ phrase: 'moral hazard' }]));
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a0', 'u1', '1999-01-01', JSON.stringify(['old-word']), '[]');

  const got = dailyPackService.getSameDaySiblingWords(db, 'u1');
  const keys = got.map(dailyPackService.stemWordKey);
  assert.ok(keys.includes(dailyPackService.stemWordKey('butterfly effect')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('signaling')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('Nash equilibrium')));
  assert.ok(keys.includes(dailyPackService.stemWordKey('moral hazard')));
  assert.ok(!keys.includes(dailyPackService.stemWordKey('old-word')));
  assert.deepStrictEqual(dailyPackService.getSameDaySiblingWords(db, 'other'), []);
  db.close();
  console.log('PASS sameDaySiblingExclude');
}

testCollectsTodayOnly();
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node vocab-server/tests/sameDaySiblingExclude.test.js`

Expected: `getSameDaySiblingWords` 未导出。

- [ ] **Step 3: 最小实现**

```javascript
function extractItemText(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(item.word || item.text || item.term || item.phrase || '').trim();
}

function parseWordListJson(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(extractItemText).filter(Boolean);
}

function getSameDaySiblingWords(db, userId) {
  const uid = normalizeUserId(userId);
  const day = getPackDate();
  const out = [];
  try {
    const rows = db.prepare(
      'SELECT words_json, phrases_json FROM daily_extracted_articles WHERE user_id = ? AND quota_date = ?'
    ).all(uid, day);
    for (const row of rows) {
      out.push(...parseWordListJson(row.words_json));
      out.push(...parseWordListJson(row.phrases_json));
    }
  } catch { /* 单测或旧库可能无表 */ }
  try {
    const rows = db.prepare(
      'SELECT vocab_json, phrases_json FROM daily_listen_articles WHERE user_id = ? AND pack_date = ?'
    ).all(uid, day);
    for (const row of rows) {
      out.push(...parseWordListJson(row.vocab_json));
      out.push(...parseWordListJson(row.phrases_json));
    }
  } catch { /* 单测或旧库可能无表 */ }
  return out;
}
```

导出 `getSameDaySiblingWords`。表不存在时返回 `[]`，禁止抛错。

- [ ] **Step 4: 再跑测试，确认通过**

Run: `node vocab-server/tests/sameDaySiblingExclude.test.js`

Expected: `PASS sameDaySiblingExclude`

**功能 3 验收：** 只收集当日、本用户；兼容 `word`/`phrase`/字符串；历史日期不入名单。通过后再进入 Task 4。

---

### Task 4: 把词形键接到过滤/历史（功能 4）

**Files:**
- Modify: `vocab-server/services/dailyPackService.js`（`filterVocabAgainstExclude`、`recordPushedWords`、`mergeExcludeLists` 比较逻辑）
- Modify: `vocab-server/tests/vocabDedupePipeline.test.js`（追加 1 个词形用例，先写再改实现）

- [ ] **Step 1: 在 pipeline 测试末尾 `run()` 前增加失败用例**

```javascript
async function testStemBlocksRefresh() {
  console.log('=== 用例 8：negotiate 已推则 negotiation 不得再入唤醒 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('negotiate'));
  const { kept, rejected } = dailyPackService.filterVocabAgainstExclude(
    words('negotiation', 'BATNA'),
    dailyPackService.getRecentPushedWords(db, 'u1'),
  );
  assert.strictEqual(kept.map((x) => x.word).join(','), 'BATNA');
  assert.ok(rejected.some((x) => dailyPackService.stemsMatch(x, 'negotiation')));
  db.close();
  console.log('  通过');
}
```

在 `run()` 里 `await testStemBlocksRefresh();`

- [ ] **Step 2: 跑测试，确认该新用例失败（旧用例应仍过，若已破再一并修）**

Run: `node vocab-server/tests/vocabDedupePipeline.test.js`

Expected: 用例 8 失败（精确匹配放行 `negotiation`）。

- [ ] **Step 3: 改比较逻辑（最小）**

`mergeExcludeLists` 仍产出原文列表。`filterVocabAgainstExclude` 改为 stem 匹配：

```javascript
function filterVocabAgainstExclude(items, excludeList) {
  const exclude = mergeExcludeLists(excludeList);
  const excludeStems = new Set(exclude.map(stemWordKey).filter(Boolean));
  const kept = [];
  const rejected = [];
  for (const item of items || []) {
    const key = stemWordKey(item?.word);
    if (!key) continue;
    if (excludeStems.has(key) || kept.some((k) => stemWordKey(k.word) === key)) {
      rejected.push(normalizePushedWord(item.word));
      continue;
    }
    kept.push(item);
    excludeStems.add(key);
  }
  return { kept, rejected };
}
```

`recordPushedWords`：插入前若窗口内已有相同 stem，跳过（仍存 `normalizePushedWord` 原文，不把 stem 写入 `word` 列）。

`fillVocabToTarget` 的 `have` 集合改为 `stemWordKey`。

- [ ] **Step 4: 再跑 pipeline 测试**

Run: `node vocab-server/tests/vocabDedupePipeline.test.js`

Expected: 用例 8 通过。此时旧唤醒用例若仍断言 `length === 10`，先不要改目标数（下一 Task）。若用例 8 因 `getRecentPushedWords` 只回 `negotiate` 而 filter 已 stem 匹配，应通过。

**功能 4 验收：** `negotiate` 挡住 `negotiation`。通过后再进入 Task 5。

---

### Task 5: 唤醒目标 5 + 关闭旧词补齐（功能 5）

**Files:**
- Modify: `vocab-server/services/dailyPackService.js`
- Modify: `vocab-server/tests/vocabDedupePipeline.test.js`

- [ ] **Step 1: 先改测试期望（TDD：测试先表达新行为）**

常量：`WAKEUP_VOCAB_TARGET` 期望变为 `5`。

`testHardFilterRejectsRecent`：最终 `names.length <= 5`，不得含 `alpha`/`beta`，允许 `< 5`。

`testRetryOnceOnShortage`：`calls === 2` 仍成立（不足仍重试 1 次）；`names.length <= 5`；不得含 `old1`…`old8`。

`testBackfillOldestWhenStillShort` **整段改成「唤醒不补齐」：**

```javascript
async function testWakeupDoesNotBackfill() {
  console.log('=== 用例 3：唤醒数量不足时不拿旧词凑数 ===');
  const db = createDb();
  const ancients = ['ancient1', 'ancient2', 'ancient3', 'ancient4', 'ancient5'];
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words(...ancients, 'recentX'));
  ancients.forEach((w, i) => {
    db.prepare('UPDATE pushed_vocab_history SET pushed_at = ? WHERE word = ?')
      .run(Date.now() - (50 + i) * DAY_MS, w);
  });
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async () => ({ vocab: words('recentX', 'onlyOne') }),
  });
  assert.ok(wakeup.vocab.length <= 5);
  assert.ok(!wakeup.vocab.some((v) => String(v.word).startsWith('ancient')));
  assert.ok(wakeup.vocab.every((v) => v.word !== 'recentX'));
  assert.strictEqual(wakeup._dedupeNotice, dailyPackService.DEDUPE_SHORT_NOTICE);
  db.close();
  console.log('  通过');
}
```

`testConsecutiveWakeupNoOverlap`：每轮切片改为 5 个（`round * 5`），断言每批 `size <= 5` 且批次无交集。

`testSharedPoolWakeupBlocksFlaw`：唤醒 mock 仍可返回 10 个，但结果 ≤5；破绽仍 `length === 6`。

- [ ] **Step 2: 跑测试，确认新期望失败**

Run: `node vocab-server/tests/vocabDedupePipeline.test.js`

Expected: 仍凑到 10 或仍出现 ancient 补齐。

- [ ] **Step 3: 改 `generateVocabWithDedupe` / 唤醒入口**

`WAKEUP_VOCAB_TARGET = 5`。

```javascript
async function generateVocabWithDedupe(db, userId, {
  moduleName,
  targetCount,
  baseExclude = '',
  callLlm,
  extraFallback = [],
  extraExclude = [],
  allowBackfill = true,
  skipRecord = false,
}) {
  // mergeExcludeLists(baseExclude, recent, dbWords, extraExclude)
  // 循环与现网相同，最多重试 DEDUPE_RETRY_COUNT 次
  const filled = allowBackfill
    ? fillVocabToTarget(db, uid, allKept, targetCount, extraFallback)
    : { words: allKept.slice(0, targetCount), usedBackfill: false };
  if (!skipRecord) recordPushedWords(db, uid, moduleName, filled.words);
  const short = !allowBackfill && filled.words.length < targetCount;
  return {
    words: filled.words,
    usedBackfill: filled.usedBackfill,
    notice: filled.usedBackfill
      ? DEDUPE_BACKFILL_NOTICE
      : (short ? DEDUPE_SHORT_NOTICE : null),
    raw: lastParsed,
    error: lastError,
  };
}
```

`generateWakeupVocabForUser`：`allowBackfill: false`，`targetCount: WAKEUP_VOCAB_TARGET`，`extraExclude: getSameDaySiblingWords(db, uid)`。  
`generateFlawVocabForUser`：不传 `allowBackfill`（默认 true），不传普通词拒绝。破绽也可带 `extraExclude: getSameDaySiblingWords`（3B，不改 6 词与补齐）。

- [ ] **Step 4: 再跑测试，确认通过**

Run: `node vocab-server/tests/vocabDedupePipeline.test.js`

Expected: 全部通过；破绽用例仍为 6。

**功能 5 验收：** 唤醒 ≤5 且不补 ancient；破绽仍 6 可补齐。通过后再进入 Task 6。

---

### Task 6: 唤醒接入 3+2 + 普通词拒绝 + 博弈槽重试（功能 6）

**Files:**
- Modify: `vocab-server/services/dailyPackService.js` 的 `generateWakeupVocabForUser`
- Modify: `vocab-server/tests/vocabDedupePipeline.test.js` 或新增断言到 `wakeupSlotPick` 的集成用例

- [ ] **Step 1: 写集成失败测试（可放 pipeline）**

```javascript
async function testWakeupSlotsAndBan() {
  console.log('=== 用例 9：唤醒 3+2 且拒绝 modeling ===');
  const db = createDb();
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: '商务谈判',
    callLlm: async () => ({
      vocab: [
        ...words('modeling', 'agenda', 'BATNA', 'reservation price', 'anchoring'),
        { word: "prisoner's dilemma", slot: 'theory', ipa: '/p/', meaning_zh: '囚徒困境', pronunciation_note: 't', example: 'x' },
        { word: 'Nash equilibrium', slot: 'theory', ipa: '/n/', meaning_zh: '纳什', pronunciation_note: 't', example: 'x' },
      ],
    }),
  });
  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(names.length <= 5);
  assert.ok(!names.includes('modeling') && !names.includes('agenda'));
  assert.ok(names.includes('BATNA'));
  assert.ok(names.includes("prisoner's dilemma"));
  db.close();
  console.log('  通过');
}
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node vocab-server/tests/vocabDedupePipeline.test.js`

Expected: `modeling` 仍可能留下，或未做槽位裁剪。

- [ ] **Step 3: 改 `generateWakeupVocabForUser`**

```javascript
async function generateWakeupVocabForUser(db, userId, {
  theme,
  historyExclude = '',
  userCurrentProfile = '',
  callLlm,
} = {}) {
  const uid = normalizeUserId(userId);
  const profile = userCurrentProfile || getUserCurrentProfile(db, uid);
  const baseExclude = String(historyExclude || '').trim();
  const runner = typeof callLlm === 'function'
    ? callLlm
    : (excludeCsv, theoryHint) => callWakeupWorkflow({
      theme: theoryHint
        ? `${theme} | fill 2 theory slots with: ${theoryHint}`
        : theme,
      userId: uid,
      historyExclude: excludeCsv,
      userCurrentProfile: profile,
    });

  const result = await generateVocabWithDedupe(db, uid, {
    moduleName: 'wakeup',
    targetCount: 20,
    baseExclude,
    extraExclude: [
      ...getSameDaySiblingWords(db, uid),
      ...GENERIC_BAN_WORDS,
    ],
    callLlm: (csv) => runner(csv),
    extraFallback: [],
    allowBackfill: false,
    skipRecord: true,
  });

  if (result.error && result.words.length === 0) throw result.error;

  let picked = pickWakeupSlots(result.words);
  const theoryCount = picked.filter((i) => resolveWakeupSlot(i) === 'theory').length;
  if (theoryCount < 2) {
    const hint = unusedTheoryHints(picked).join(', ');
    const retry = await generateVocabWithDedupe(db, uid, {
      moduleName: 'wakeup',
      targetCount: 20,
      baseExclude,
      extraExclude: [
        ...getSameDaySiblingWords(db, uid),
        ...GENERIC_BAN_WORDS,
        ...picked.map((i) => i.word),
      ],
      callLlm: (csv) => runner(csv, hint),
      allowBackfill: false,
      skipRecord: true,
    });
    picked = pickWakeupSlots([...picked, ...retry.words]);
  }

  recordPushedWords(db, uid, 'wakeup', picked);
  try { purgeExpiredPushedWords(db); } catch { /* ignore */ }

  const wakeup = normalizeWakeupPayload({
    ...((result.raw && typeof result.raw === 'object' && !Array.isArray(result.raw)) ? result.raw : {}),
    theme: (result.raw && result.raw.theme) || theme,
    vocab: picked,
  }, theme);
  if (picked.length < WAKEUP_VOCAB_TARGET) wakeup._dedupeNotice = DEDUPE_SHORT_NOTICE;
  return wakeup;
}
```

注意：`generateVocabWithDedupe` 的 `targetCount: 20` 只为「收集足够候选再 3+2 裁剪」，**对外展示仍最多 5**（`pickWakeupSlots` 保证）。`WAKEUP_VOCAB_TARGET` 仍为 5，用于少推提示。不要把 20 写进 Dify Prompt。

`callLlm` 单测注入若只接受 1 个参数，`runner(csv, hint)` 多传 hint 无影响。

- [ ] **Step 4: 再跑全部相关测试**

```
node vocab-server/tests/vocabStem.test.js
node vocab-server/tests/wakeupSlotPick.test.js
node vocab-server/tests/sameDaySiblingExclude.test.js
node vocab-server/tests/vocabDedupePipeline.test.js
```

Expected: 全部 PASS。

**功能 6 验收：** 用例 9 无 `modeling`，含主题词与博弈词，长度 ≤5。通过后再进入 Task 7。

---

### Task 7: Dify 唤醒 YAML（功能 7）

**Files:**
- Modify: `yml/time_base/english_wakeup_routine.yml`（`wakeup-system-prompt` 文本）

- [ ] **Step 1: 替换下列原文（只改这些片段，不动知识检索/画像段落）**

将：

`词条应优先选择适合 TTS 朗读的商务高频词；若检索到 1-3 天内的新错词，必须优先纳入 vocab 列表。`

改为：

`词条必须采用 3+2：前 3 个为当前主题的 C1/C2 专业术语，后 2 个必须来自博弈论/逻辑学/系统论（如 prisoner's dilemma、Nash equilibrium、butterfly effect），并尽量能解释当前主题。禁止 modeling、agenda、deadline、meeting 等普通高频词。若检索到 1-3 天内的新错词且不属于禁止词、也不在避重列表，可纳入主题专业槽。每个 vocab 项增加可选 slot：theme 或 theory。`

将 vocab 对象示例增加一行：`"slot": "theme 或 theory"`。

将：

`vocab 必须恰好 10 个词。`

改为：

`vocab 最多 5 个词（3 个 theme + 2 个 theory），宁缺毋滥，禁止用普通词凑数。`

- [ ] **Step 2: 用搜索确认旧句已不存在**

Run: `rg "恰好 10 个词|商务高频词" yml/time_base/english_wakeup_routine.yml`

Expected: 无匹配。

- [ ] **Step 3: 提醒（不改代码）**

线上 Dify 需手动导入该 YAML，否则 LLM 仍可能吐 10 个高频词；服务端 Task 5–6 仍会裁成 ≤5 并拒普通词。

**功能 7 验收：** 仓库 YAML 已无「恰好 10 / 商务高频词」。通过后再进入 Task 8。

---

### Task 8: 前端标题与少推提示（功能 8）

**Files:**
- Modify: `src/services/dailyPackAPI.ts`
- Modify: `src/components/modules/DailyWakeupModule.tsx`
- Modify: `vocab-server/tests/dailyPackTodaySla.test.js`

- [ ] **Step 1: 类型**

`WakeupPayload` 增加 `_dedupeNotice?: string | null;`  
`WakeupWord` 增加可选 `slot?: 'theme' | 'theory';`

- [ ] **Step 2: 标题与 notice**

`DailyWakeupModule.tsx` 将：

`10 个高频词发音注意点`

改为：

`今日主题专业词（3+2）`

`applyPack` 在非 stale 时优先展示 `pack.wakeup._dedupeNotice`：

```typescript
const dedupeNotice = pack.wakeup._dedupeNotice;
setNotice(
  pack.stale
    ? `这份材料还是按「${pack.theme}」生成的，点刷新按「${pack.currentTheme || theme}」重做。`
    : (dedupeNotice || `已加载今日唤醒：${pack.currentTheme || theme}`),
);
```

不改网格布局、打卡、TTS、收录按钮。

- [ ] **Step 3: SLA 契约补一行**

在 `dailyPackTodaySla.test.js` 读取 `DailyWakeupModule.tsx` 的块中增加：

```javascript
assert.ok(!moduleContent.includes('10 个高频词发音注意点'), '唤醒标题不得再写 10 个高频词');
assert.ok(moduleContent.includes('今日主题专业词（3+2）'), '唤醒标题必须改为 3+2');
```

- [ ] **Step 4: 跑 SLA**

Run: `node vocab-server/tests/dailyPackTodaySla.test.js`

Expected: PASS。

**功能 8 验收：** 标题已改；少推文案能显示；布局未动。通过后再进入 Task 9。

---

### Task 9: 回归与手工验收清单

- [ ] **Step 1: 跑本规格全部自动测试**

```
node vocab-server/tests/vocabStem.test.js
node vocab-server/tests/wakeupSlotPick.test.js
node vocab-server/tests/sameDaySiblingExclude.test.js
node vocab-server/tests/vocabDedupePipeline.test.js
node vocab-server/tests/dailyPackTodaySla.test.js
```

Expected: 全部 PASS。

- [ ] **Step 2: 手工用例（部署 Dify 后或本机有 Key 时）**

| # | 菜单路径 | 测试数据 | 预期 | 对应需求 |
|---|---|---|---|---|
| 1 | 英语 → 每日唤醒 → 生成/刷新 | 主题「商务谈判」 | ≤5 词；3 主题专业 + 2 博弈/逻辑；无 modeling/agenda | 减量 + 3+2 |
| 2 | 同上，连续刷新 2 次 | 上一批含 negotiate | 不得再出 negotiate / negotiation / negotiating | 词形 |
| 3 | 当日长文或精听已有 butterfly effect | 再生成唤醒 | 唤醒不得再出 butterfly effect(s) | 3B |
| 4 | （单测已覆盖）LLM 只吐旧词/普通词 | — | <5 且无 ancient 补齐；有少推提示 | 4A |
| 5 | 英语 → 每日破绽词汇 | 任意主题 | 仍 6 词 | 破绽不动 |
| 6 | 进站只读今日包 | 已有缓存 | 不触发同步 LLM | SLA |

---

## Spec 覆盖自检

| 规格章节 | 对应 Task |
|---|---|
| 最多 5 词 | Task 5 |
| 3+2 混合 | Task 2、6、7 |
| 破绽 6 不动 | Task 5（flaw 默认 `allowBackfill: true`） |
| 30 天池 + 当日长文/精听 | Task 3、5 |
| model* 与 negotiate/negotiation | Task 1、4 |
| 唤醒不凑旧词 | Task 5 |
| 普通词拒绝 | Task 2、6、7 |
| YAML | Task 7 |
| 标题 / 少推提示 | Task 8 |
| today SLA | Task 8–9 |
| 不改 input_signature | 全程不把 sibling/history 写入 `computeInputSignature` |

无 TBD。函数名前后一致：`stemWordKey`、`pickWakeupSlots`、`getSameDaySiblingWords`、`DEDUPE_SHORT_NOTICE`、`allowBackfill`、`skipRecord`。
