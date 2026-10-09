# Listen Voice Accent + Pressure Factors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精听盲听用真实 Edge TTS Voice 产生口音，页内可选 Voice + 压力勾选；每日 Cron 用用户最后 Voice 且强制三压力；去掉 ffmpeg 变调口音。

**Architecture:** 复用 `VOICE_OPTIONS` 与 `/api/tts/speech`；新增 `user_listen_prefs` + GET/PUT；`ListenTab` 换 Voice 选择器（GSAP 微动效）；`applyAudioEffects` 删除 accent 分支；预生成合成注入 prefs Voice + 强制 effects。

**Tech Stack:** React + Vite、gsap / `@gsap/react`、Express + better-sqlite3、Edge TTS、ffmpeg 后处理

**Design contract:** `docs/superpowers/specs/2026-08-17-listen-voice-pressure-design.md`

**Git:** 未获用户明确要求前 **不要 git commit**；完成任务后暂存验证即可。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `vocab-server/services/listenPrefsService.js` | `user_listen_prefs` 建表、读写、VoiceId 校验、默认 `en-US-BrianNeural`、Cron 强制 effects 常量 |
| `vocab-server/server.js` | 挂载 prefs API；`applyAudioEffects` 去 accent；必要时导出允许的 voice 列表 |
| `vocab-server/services/dailyListenPreGenerateService.js` | `synthesizeAudioFile` 按 userId 读 prefs + 强制三压力 |
| `vocab-server/tests/listenPrefsService.test.js` | prefs + 默认 Voice/effects 契约 |
| `vocab-server/tests/listenVoicePressure.contract.test.js` | 前端/后端源码契约（无 accent 入口、有 Voice） |
| `src/services/listenPrefsAPI.ts` | GET/PUT 客户端 |
| `src/services/ttsAPI.ts` / `listeningAPI.ts` | effects 类型去掉 `accent` |
| `src/components/modules/english/tabs/ListenVoicePicker.tsx` | 本页 Voice 选择器 + 国家旁注 + GSAP |
| `src/components/modules/english/tabs/ListenTab.tsx` | 替换口音下拉；接 voiceId；写 prefs；effects 无 accent |
| `src/config/voices.ts` | 复用，不改结构（除非缺 id） |

---

### Task 1: 后端停用口音变调

**Files:**
- Modify: `vocab-server/server.js`（`applyAudioEffects` 内 accent / rubberband 段）
- Test: `vocab-server/tests/listenVoicePressure.contract.test.js`（本 Task 先写失败断言）

- [ ] **Step 1: 写失败契约测试**

```javascript
// vocab-server/tests/listenVoicePressure.contract.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
const serverSource = fs.readFileSync(serverPath, 'utf8');

assert.ok(
  !/effects\.accent === 'indian'/.test(serverSource),
  'applyAudioEffects must not branch on effects.accent indian'
);
assert.ok(
  !/rubberband=pitch/.test(serverSource),
  'accent rubberband pitch filters must be removed'
);

console.log('listenVoicePressure contract (accent removal) passed');
```

- [ ] **Step 2: 运行确认失败**

Run: `node vocab-server/tests/listenVoicePressure.contract.test.js`  
Expected: FAIL（仍含 indian / rubberband）

- [ ] **Step 3: 删除 accent 变调分支**

在 `applyAudioEffects` 中删除整段：

```javascript
// DELETE this block entirely:
if (effects.accent) {
  if (effects.accent === 'indian') {
    filterParts.push('rubberband=pitch=0.95');
  } else if (effects.accent === 'british') {
    filterParts.push('rubberband=pitch=1.05');
  } else if (effects.accent === 'australian') {
    filterParts.push('rubberband=pitch=1.02');
  }
}
```

保留 `packet_loss` / `interruptions` / `information_gap` 逻辑不变。

- [ ] **Step 4: 再跑测试**

Run: `node vocab-server/tests/listenVoicePressure.contract.test.js`  
Expected: PASS（本文件当前仅 accent 断言；后续 Task 再追加）

---

### Task 2: `listenPrefsService` + API

**Files:**
- Create: `vocab-server/services/listenPrefsService.js`
- Modify: `vocab-server/server.js`（`init` 建表 + 路由）
- Test: `vocab-server/tests/listenPrefsService.test.js`

- [ ] **Step 1: 写失败单测（内存 sqlite）**

```javascript
// vocab-server/tests/listenPrefsService.test.js
const assert = require('assert');
const Database = require('better-sqlite3');
const {
  initListenPrefsTable,
  getListenVoiceId,
  upsertListenVoiceId,
  DEFAULT_LISTEN_VOICE_ID,
  CRON_FORCE_LISTEN_EFFECTS,
  isAllowedListenVoiceId,
} = require('../services/listenPrefsService');

const db = new Database(':memory:');
initListenPrefsTable(db);

assert.strictEqual(getListenVoiceId(db, 'u1'), DEFAULT_LISTEN_VOICE_ID);
assert.strictEqual(DEFAULT_LISTEN_VOICE_ID, 'en-US-BrianNeural');
assert.deepStrictEqual(CRON_FORCE_LISTEN_EFFECTS, {
  interruptions: true,
  packet_loss: true,
  information_gap: true,
});

assert.ok(isAllowedListenVoiceId('en-IN-NeerjaNeural'));
assert.ok(!isAllowedListenVoiceId('not-a-voice'));

upsertListenVoiceId(db, 'u1', 'en-IN-NeerjaNeural');
assert.strictEqual(getListenVoiceId(db, 'u1'), 'en-IN-NeerjaNeural');

assert.throws(() => upsertListenVoiceId(db, 'u1', 'bad-voice'), /invalid voice/i);

console.log('listenPrefsService tests passed');
```

- [ ] **Step 2: 运行确认失败**

Run: `node vocab-server/tests/listenPrefsService.test.js`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 service**

```javascript
// vocab-server/services/listenPrefsService.js
const DEFAULT_LISTEN_VOICE_ID = 'en-US-BrianNeural';

const CRON_FORCE_LISTEN_EFFECTS = Object.freeze({
  interruptions: true,
  packet_loss: true,
  information_gap: true,
});

/** 与 src/config/voices.ts 的 id 对齐（实现时完整拷贝全部 id 数组） */
const ALLOWED_LISTEN_VOICE_IDS = new Set([
  'en-GB-LibbyNeural',
  'en-GB-MaisieNeural',
  'en-GB-RyanNeural',
  'en-GB-SoniaNeural',
  'en-GB-ThomasNeural',
  'en-US-EmmaNeural',
  'en-US-AvaNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural',
  'en-US-AnaNeural',
  'en-US-AriaNeural',
  'en-US-ChristopherNeural',
  'en-US-EricNeural',
  'en-US-GuyNeural',
  'en-US-JennyNeural',
  'en-US-MichelleNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-US-AndrewMultilingualNeural',
  'en-US-AvaMultilingualNeural',
  'en-US-BrianMultilingualNeural',
  'en-US-EmmaMultilingualNeural',
  'en-AU-WilliamMultilingualNeural',
  'en-AU-NatashaNeural',
  'en-CA-ClaraNeural',
  'en-CA-LiamNeural',
  'en-HK-YanNeural',
  'en-HK-SamNeural',
  'en-IN-NeerjaNeural',
  'en-IN-PrabhatNeural',
  'en-IE-ConnorNeural',
  'en-IE-EmilyNeural',
  'en-KE-AsiliaNeural',
  'en-KE-ChilembaNeural',
  'en-NZ-MitchellNeural',
  'en-NZ-MollyNeural',
  'en-NG-AbeoNeural',
  'en-NG-EzinneNeural',
  'en-PH-JamesNeural',
  'en-PH-RosaNeural',
  'en-SG-LunaNeural',
  'en-SG-WayneNeural',
  'en-ZA-LeahNeural',
  'en-ZA-LukeNeural',
  'en-TZ-ElimuNeural',
  'en-TZ-ImaniNeural',
]);

function initListenPrefsTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_listen_prefs (
      user_id TEXT PRIMARY KEY,
      listen_voice_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
}

function isAllowedListenVoiceId(voiceId) {
  return typeof voiceId === 'string' && ALLOWED_LISTEN_VOICE_IDS.has(voiceId);
}

function getListenVoiceId(db, userId) {
  const row = db.prepare(
    'SELECT listen_voice_id FROM user_listen_prefs WHERE user_id = ?'
  ).get(userId);
  if (row && isAllowedListenVoiceId(row.listen_voice_id)) {
    return row.listen_voice_id;
  }
  return DEFAULT_LISTEN_VOICE_ID;
}

function upsertListenVoiceId(db, userId, voiceId) {
  if (!isAllowedListenVoiceId(voiceId)) {
    throw new Error('invalid voiceId');
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_listen_prefs (user_id, listen_voice_id, updated_at, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      listen_voice_id = excluded.listen_voice_id,
      updated_at = excluded.updated_at
  `).run(userId, voiceId, now, now);
  return voiceId;
}

module.exports = {
  DEFAULT_LISTEN_VOICE_ID,
  CRON_FORCE_LISTEN_EFFECTS,
  ALLOWED_LISTEN_VOICE_IDS,
  initListenPrefsTable,
  isAllowedListenVoiceId,
  getListenVoiceId,
  upsertListenVoiceId,
};
```

- [ ] **Step 4: 挂载 init + 路由**

在 `server.js` 启动建表处调用 `initListenPrefsTable(db)`。

```javascript
const listenPrefsService = require('./services/listenPrefsService');

// init with other tables:
listenPrefsService.initListenPrefsTable(db);

app.get('/api/english/listen-prefs', (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const voiceId = listenPrefsService.getListenVoiceId(db, userId);
    const stored = db.prepare(
      'SELECT listen_voice_id FROM user_listen_prefs WHERE user_id = ?'
    ).get(userId);
    return res.json({
      success: true,
      voiceId: stored ? voiceId : null,
      effectiveVoiceId: voiceId,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/english/listen-prefs', (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const voiceId = String(req.body?.voiceId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const saved = listenPrefsService.upsertListenVoiceId(db, userId, voiceId);
    return res.json({ success: true, voiceId: saved });
  } catch (e) {
    const status = /invalid voice/i.test(e.message) ? 400 : 500;
    return res.status(status).json({ success: false, error: e.message });
  }
});
```

说明：`voiceId: null` 表示从未保存；`effectiveVoiceId` 始终为 Cron/页可用的有效值（含兜底）。

- [ ] **Step 5: 跑通单测**

Run: `node vocab-server/tests/listenPrefsService.test.js`  
Expected: PASS

---

### Task 3: 每日预生成使用 prefs Voice + 强制三压力

**Files:**
- Modify: `vocab-server/services/dailyListenPreGenerateService.js`
- Modify: `vocab-server/tests/listenPrefsService.test.js`（或新建断言调用约定的小测）
- 若 `server.js` 有注入 `setGenerators({ synthesizeAudioFile })`，同步改签名

- [ ] **Step 1: 扩展契约断言**

在 `listenVoicePressure.contract.test.js` 追加：

```javascript
const pregenPath = path.join(__dirname, '../services/dailyListenPreGenerateService.js');
const pregenSource = fs.readFileSync(pregenPath, 'utf8');
assert.ok(
  !/edge-tts\/en-US-EmmaNeural/.test(pregenSource),
  'default EmmaNeural must be removed from pregenerate synthesize'
);
assert.ok(
  pregenSource.includes('getListenVoiceId') || pregenSource.includes('listenPrefsService'),
  'pregenerate must read listen prefs voice'
);
assert.ok(
  pregenSource.includes('CRON_FORCE_LISTEN_EFFECTS') || pregenSource.includes('interruptions: true'),
  'pregenerate must apply forced pressure effects'
);
```

Run 预期先 FAIL。

- [ ] **Step 2: 改默认 `synthesizeAudioFile`**

```javascript
// dailyListenPreGenerateService.js — require at top:
const listenPrefsService = require('./listenPrefsService');

// replace generators.synthesizeAudioFile:
synthesizeAudioFile: async (text, outputPath, ctx = {}) => {
  if (typeof global !== 'undefined' && typeof global.synthesizeAndSaveAudio === 'function') {
    const userId = ctx.userId || 'default-user';
    // db 需从闭包/注入获得；若本函数无 db，则要求 ctx.voiceId 已解析
    const voiceId = ctx.voiceId
      || listenPrefsService.DEFAULT_LISTEN_VOICE_ID;
    const model = `edge-tts/${voiceId}`;
    const effects = listenPrefsService.CRON_FORCE_LISTEN_EFFECTS;
    await global.synthesizeAndSaveAudio(text, model, outputPath, null, null, { effects });
    return outputPath;
  }
  throw new Error('synthesizeAudioFile engine not injected');
},
```

- [ ] **Step 3: 调用点传入 voiceId**

在 `generateOneCombo`（及 `synthesizeAudioFile(script, audioPath)` 另一处）改为：

```javascript
const voiceId = listenPrefsService.getListenVoiceId(db, parts.userId);
await generators.synthesizeAudioFile(script, audioPath, {
  userId: parts.userId,
  voiceId,
});
```

对 `scriptText` 同步音频路径同样传入 `parts.userId` / 解析后的 `voiceId`。

若 `server.js` 覆盖了 `setGenerators({ synthesizeAudioFile })`，改为相同签名：`(text, outputPath, ctx)` 并用 `getListenVoiceId` + `CRON_FORCE_LISTEN_EFFECTS`。

- [ ] **Step 4: 跑契约测试**

Run: `node vocab-server/tests/listenVoicePressure.contract.test.js`  
Expected: PASS（含 Task1+本 Task 断言）

---

### Task 4: 前端 TTS 类型去掉 accent

**Files:**
- Modify: `src/services/ttsAPI.ts`
- Modify: `src/services/listeningAPI.ts`

- [ ] **Step 1: 更新类型**

```typescript
// ttsAPI.ts
export interface TtsSpeechOptions {
  model?: string;
  isAsync?: boolean;
  effects?: {
    packet_loss?: boolean;
    interruptions?: boolean;
    information_gap?: boolean;
  };
}
```

```typescript
// listeningAPI.ts — fetchDifyTTS options.effects 同步去掉 accent
effects?: {
  packet_loss?: boolean;
  interruptions?: boolean;
  information_gap?: boolean;
};
```

- [ ] **Step 2: 全仓搜索残留**

Run: `rg "effects\.accent|accent\?: 'indian'" src vocab-server --glob '!**/node_modules/**'`  
Expected: ListenTab / BlindListeningCabin 若仍引用，在 Task 6–7 清除；本 Task 至少 API 层已无 accent。

---

### Task 5: 前端 `listenPrefsAPI`

**Files:**
- Create: `src/services/listenPrefsAPI.ts`

- [ ] **Step 1: 实现客户端**

```typescript
import { getAppUserId } from '../utils/profileHelper';

export interface ListenPrefsResponse {
  success: boolean;
  voiceId: string | null;
  effectiveVoiceId: string;
  error?: string;
}

export async function fetchListenPrefs(userId = getAppUserId()): Promise<ListenPrefsResponse> {
  const res = await fetch(`/api/english/listen-prefs?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as ListenPrefsResponse;
}

export async function saveListenPrefs(
  voiceId: string,
  userId = getAppUserId()
): Promise<ListenPrefsResponse> {
  const res = await fetch('/api/english/listen-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, voiceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as ListenPrefsResponse;
}
```

- [ ] **Step 2: Typecheck / 构建无报错**（有则跑 `npx tsc --noEmit` 或项目既有 check）

---

### Task 6: `ListenVoicePicker`（含 GSAP）

**Files:**
- Create: `src/components/modules/english/tabs/ListenVoicePicker.tsx`

- [ ] **Step 1: 实现组件**

```tsx
import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { VOICE_OPTIONS, type VoiceOption } from '../../../../config/voices';

gsap.registerPlugin(useGSAP);

export interface ListenVoicePickerProps {
  value: string;
  onChange: (voiceId: string) => void;
}

export function ListenVoicePicker({ value, onChange }: ListenVoicePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = VOICE_OPTIONS.find((v) => v.id === value) || VOICE_OPTIONS.find((v) => v.id === 'en-US-BrianNeural');

  useGSAP(
    () => {
      if (!panelRef.current) return;
      if (open) {
        gsap.fromTo(
          panelRef.current,
          { autoAlpha: 0, y: -6 },
          { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' }
        );
      } else {
        gsap.set(panelRef.current, { autoAlpha: 0, y: -6 });
      }
    },
    { scope: rootRef, dependencies: [open], revertOnUpdate: true }
  );

  useGSAP(
    () => {
      const el = rootRef.current?.querySelector('[data-country-label]');
      if (!el) return;
      gsap.fromTo(el, { autoAlpha: 0.4 }, { autoAlpha: 1, duration: 0.2 });
    },
    { scope: rootRef, dependencies: [value], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-black/30 text-white/90 text-[10px] px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/20"
      >
        Voice: {selected?.name || value}
      </button>
      <span data-country-label className="text-[10px] text-white/60">
        国家: {selected?.country || '—'}
      </span>
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-1 z-30 max-h-56 w-72 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 p-2 shadow-xl"
        >
          {VOICE_OPTIONS.map((voice: VoiceOption) => (
            <button
              key={voice.id}
              type="button"
              className={`w-full text-left text-[10px] px-2 py-1.5 rounded ${
                voice.id === value ? 'bg-[#FF5722]/30 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
              onClick={() => {
                onChange(voice.id);
                setOpen(false);
              }}
            >
              {voice.name} · {voice.country} · {voice.gender}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 确认 `@gsap/react` / `gsap` 已在 `package.json`（已有则跳过安装）**

---

### Task 7: 改造 `ListenTab`

**Files:**
- Modify: `src/components/modules/english/tabs/ListenTab.tsx`

- [ ] **Step 1: 状态替换**

删除 `listenAccent` state。新增：

```tsx
const [listenVoiceId, setListenVoiceId] = useState('en-US-BrianNeural');

useEffect(() => {
  void fetchListenPrefs()
    .then((p) => setListenVoiceId(p.effectiveVoiceId || p.voiceId || 'en-US-BrianNeural'))
    .catch(() => { /* keep default */ });
}, []);

const handleVoiceChange = (voiceId: string) => {
  setListenVoiceId(voiceId);
  void saveListenPrefs(voiceId).catch(() => {
    showNotice('listen', '音色偏好保存失败，本次仍可用所选 Voice', 'error');
  });
};
```

- [ ] **Step 2: effects / ref**

```tsx
const listenEffectsRef = useRef({
  listenVoiceId,
  listenInterruptions,
  listenPacketLoss,
  listenInfoGap,
});

useEffect(() => {
  listenEffectsRef.current = {
    listenVoiceId,
    listenInterruptions,
    listenPacketLoss,
    listenInfoGap,
  };
}, [listenVoiceId, listenInterruptions, listenPacketLoss, listenInfoGap]);

const buildListenTtsEffects = () => {
  const s = listenEffectsRef.current;
  return {
    packet_loss: s.listenPacketLoss,
    interruptions: s.listenInterruptions,
    information_gap: s.listenInfoGap,
  };
};

const hasActiveListenEffects = () => {
  const s = listenEffectsRef.current;
  return s.listenPacketLoss || s.listenInterruptions || s.listenInfoGap;
};
```

- [ ] **Step 3: 所有 `fetchDifyTTS` 调用带上 voiceId**

```tsx
fetchDifyTTS(script, {
  isAsync: true,
  voiceId: listenEffectsRef.current.listenVoiceId,
  effects: buildListenTtsEffects(),
})
```

（两处：任务完成回调 + 直接生成路径，均改。）

- [ ] **Step 4: UI 替换口音下拉**

压力因素区改为：

```tsx
{listenMode === 'auto' && (
  <div className="flex flex-wrap items-center gap-3 mt-3 ...">
    <span className="...">压力因素:</span>
    <ListenVoicePicker value={listenVoiceId} onChange={handleVoiceChange} />
    {/* 三个 checkbox 保持不变 */}
  </div>
)}
```

删除含「标准发音 / 印度口音 / 英国口音 / 澳洲口音」的 `<select>`。

- [ ] **Step 5: 确认不写 Header 全局音色**

禁止在本页对 `super_agent_default_voice` 赋值。

---

### Task 8: 契约测试收口

**Files:**
- Modify: `vocab-server/tests/listenVoicePressure.contract.test.js`
- Modify: `vocab-server/tests/listenUploadStress.test.js`（若仍断言 BlindListeningCabin accent 文案，保留 Cabin；新增 ListenTab 断言）

- [ ] **Step 1: 追加前端契约**

```javascript
const listenTabPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenTab.tsx');
const listenTabSource = fs.readFileSync(listenTabPath, 'utf8');
assert.ok(listenTabSource.includes('ListenVoicePicker'), 'ListenTab must use ListenVoicePicker');
assert.ok(!/印度口音 \(India\)/.test(listenTabSource), 'old accent select labels must be removed from ListenTab');
assert.ok(!/accent:\s*\(s\.listenAccent/.test(listenTabSource), 'buildListenTtsEffects must not send accent');

const pickerPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenVoicePicker.tsx');
assert.ok(fs.existsSync(pickerPath), 'ListenVoicePicker.tsx must exist');
const pickerSource = fs.readFileSync(pickerPath, 'utf8');
assert.ok(pickerSource.includes('useGSAP'), 'Voice picker must use useGSAP');
assert.ok(pickerSource.includes('VOICE_OPTIONS'), 'Voice picker must use VOICE_OPTIONS');

const serverSource2 = fs.readFileSync(serverPath, 'utf8');
assert.ok(serverSource2.includes('/api/english/listen-prefs'), 'listen-prefs API must exist');
```

- [ ] **Step 2: 跑全部相关测试**

```bash
node vocab-server/tests/listenPrefsService.test.js
node vocab-server/tests/listenVoicePressure.contract.test.js
node vocab-server/tests/listenUploadStress.test.js
```

Expected: 全部 PASS（若 `listenUploadStress` 因 Cabin 仍含 accent 字符串则保持其原断言，勿误删 Cabin 功能）。

---

### Task 9: 手工验收清单（实现后执行）

- [ ] **EN-LIS-03 页内**
  - 路径：英语引擎 → 精听盲听
  - 选 `Neerja`，确认旁注「印度 (IN)」
  - 勾选故意打断 + 网络卡顿，生成今日精听
  - 预期：印度口音；可感知勾选压力；Header 全局音色不变

- [ ] **prefs**
  - 选 `Prabhat` 后刷新页面，Voice 仍为 Prabhat
  - `GET /api/english/listen-prefs?userId=<账号>` 返回对应 voiceId

- [ ] **Cron / 预生成路径（可用单用户脚本或 backfill）**
  - 触发该用户音频合成后，日志/调用应使用 prefs Voice
  - 音频应含三压力（打断+卡顿+白噪），与页内「全关」听感不同

- [ ] **回归**
  - 上传音频模式仍可用
  - 任务中心 TTS 异步进度仍可见

---

## Spec coverage self-review

| Spec 要求 | Task |
|-----------|------|
| Voice 优先 + 国家展示 | 6, 7 |
| 删除旧口音下拉 | 7, 8 |
| 真实 Voice TTS，无 accent 变调 | 1, 4, 7 |
| 页内压力 ffmpeg | 既有 + 7 |
| Cron prefs Voice | 2, 3 |
| Cron 强制三压力 | 2, 3 |
| 服务端 listen prefs | 2, 5, 7 |
| 不改 Header 全局 | 7 Step 5 |
| GSAP 仅 Voice 选择器 | 6 |
| EN-LIS-03 验收 | 9 |

无 TBD。类型名统一：`listen_voice_id` / `voiceId` / `DEFAULT_LISTEN_VOICE_ID` / `CRON_FORCE_LISTEN_EFFECTS`。
