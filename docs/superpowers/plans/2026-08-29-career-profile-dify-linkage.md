# 职业路径账号画像联动 Implementation Plan

> **进度注记（2026-08-29）：** Tasks 1–8 自动化部分已完成（5 项契约/单测全部 PASS）；Step 2–5 手工验收待用户执行。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侧栏职业路径写入当前登录账号画像，经 `user_current_profile` 注入所有 Dify 调用；全局设置可打开 P1 画像页（进入前 LLM 精简并自动落库）；画像写入一律同类主题按最新时效覆盖。

**Architecture:** 职业路径结构化存于 `user_memories.memory_layers.career_path`，本地 `superme_career` 作镜像；`injectUserProfile` 现读并前置拼接职业摘要；增量短板经 `memory/ingest` 的 Profile Dedupe 合并；全局设置关闭后打开 `UserProfileOverlay`（S1 compress 落库后再展示）。

**Tech Stack:** React + TypeScript 前端、`profileHelper` / `careerProgression`、vocab-server Express + SQLite、现有 Dify Profile Dedupe（`/api/user/profile/compress`）、node:test / 前端契约测试

**Spec:** `docs/superpowers/specs/2026-08-29-career-profile-dify-linkage-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/utils/careerProgression.ts` | 解析、本地镜像、职业摘要串、`applyCareerPathFromLayers` |
| `src/utils/careerProgression.test.ts` | 摘要串与 parse 单测 |
| `src/utils/profileHelper.ts` | save 带 career/memoryLayers；load 时还原 career；inject 前置职业行；短板增量走 ingest |
| `vocab-server/server.js` | `POST /api/user/profile/save` 合并 `careerPath` → `memory_layers.career_path` |
| `vocab-server/tests/careerPathProfileSave.test.js` | 保存/读回 career 契约 |
| `src/components/Sidebar.tsx` | 仍调用 `writeCareerPath`（行为扩展为同步账号） |
| `src/components/UserProfileOverlay.tsx` | **新建** P1 全屏页 + 进入 Loading |
| `src/components/GlobalSettingsPanel.tsx` | 入口预览 + 打开流程 |
| `src/App.tsx` | 挂载 Overlay（或由 Settings 自管 portal） |
| `vocab-server/tests/careerProgressionFrontend.test.js` | 扩展：inject/settings/overlay 契约 |
| `vocab-server/tests/profileAppendFreshnessContract.test.js` | 增量写入走 ingest/dedupe 契约 |

---

### Task 1: 职业摘要串与本地 API 扩展

**Files:**
- Modify: `src/utils/careerProgression.ts`
- Modify: `src/utils/careerProgression.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/utils/careerProgression.test.ts` 追加：

```ts
import { formatCareerProfileLine, applyCareerPathLocal } from './careerProgression';

test('formatCareerProfileLine 生成注入用短行', () => {
  const line = formatCareerProfileLine({
    history: '高级经理 (Senior Manager)',
    current: '总监 (Director)',
    target: '合伙人 (Partner / Managing Director)',
    progress: 23,
  });
  assert.equal(
    line,
    '职业路径: 起点=高级经理 (Senior Manager); 当前=总监 (Director); 目标=合伙人 (Partner / Managing Director); 能力匹配度=23%',
  );
});

test('applyCareerPathLocal 写入 localStorage 并返回 parse 结果', () => {
  // 若测试环境无 localStorage，用简易 mock；或仅测 parseCareerPath 已覆盖时，本步改为纯函数测试 format 即可
  const next = parseCareerPath({ history: 'A', current: 'B', target: 'C', progress: 40 });
  assert.equal(formatCareerProfileLine(next).includes('能力匹配度=40%'), true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx tsx --test src/utils/careerProgression.test.ts`  
（若项目惯用其他 runner，与现有 `careerProgression.test.ts` 运行方式一致）  
Expected: FAIL — `formatCareerProfileLine` 未导出

- [ ] **Step 3: 最小实现**

在 `src/utils/careerProgression.ts` 增加：

```ts
export function formatCareerProfileLine(career: CareerPath): string {
  const c = parseCareerPath(career);
  return `职业路径: 起点=${c.history}; 当前=${c.current}; 目标=${c.target}; 能力匹配度=${c.progress}%`;
}

/** 仅写本地镜像并广播（不打服务端；服务端由 profileHelper.syncCareerToServer 负责） */
export function applyCareerPathLocal(data: CareerPath): CareerPath {
  const next = parseCareerPath(data);
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CAREER_CHANGED_EVENT));
  return next;
}
```

保留现有 `writeCareerPath` 签名；Task 3 再改为「本地 + 同步服务端」。

- [ ] **Step 4: 再跑测试**

Expected: PASS

- [ ] **Step 5: Commit**（仅当用户要求提交时执行；否则跳过）

```bash
git add src/utils/careerProgression.ts src/utils/careerProgression.test.ts
git commit -m "feat(career): add formatCareerProfileLine for Dify inject"
```

---

### Task 2: 后端 profile/save 合并 career_path

**Files:**
- Modify: `vocab-server/server.js`（`POST /api/user/profile/save` 约 3068–3084 行）
- Create: `vocab-server/tests/careerPathProfileSave.test.js`

- [ ] **Step 1: 写失败契约测试**

```js
/**
 * 运行：node vocab-server/tests/careerPathProfileSave.test.js
 * 若需启服：依赖现有 test harness；否则用源码静态断言 + 可选 HTTP。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

assert.match(serverSrc, /careerPath|career_path/, 'profile/save 必须处理 careerPath');
assert.match(
  serverSrc,
  /memory_layers[\s\S]{0,200}career_path|career_path[\s\S]{0,200}memory_layers/,
  'career 必须写入 memory_layers.career_path',
);
console.log('OK careerPath profile save contract (static)');
```

完整 HTTP 测（若本机可起 server）：`POST /api/user/profile/save` body `{ userId, careerPath: { history, current, target, progress } }` 后 `GET /api/user/profile/:userId`，断言 `data.memory_layers.career_path.progress === 23`。

- [ ] **Step 2: 改 save 处理器**

将 `app.post('/api/user/profile/save', ...)` 改为可接收 `careerPath` / `memoryLayers`：

```js
app.post('/api/user/profile/save', (req, res) => {
  const { userId, profileContent, errorLedger, careerPath, memoryLayers: incomingLayers } = req.body || {};
  const uid = normalizeMemoryUserId(userId);
  const now = Date.now();
  try {
    const existing = db.prepare('SELECT profile_content, error_ledger, memory_layers FROM user_memories WHERE user_id = ?').get(uid);
    let layers = parseJsonObject(existing?.memory_layers, {});
    if (incomingLayers && typeof incomingLayers === 'object') {
      layers = { ...layers, ...incomingLayers };
    }
    if (careerPath && typeof careerPath === 'object') {
      layers.career_path = {
        history: String(careerPath.history || ''),
        current: String(careerPath.current || ''),
        target: String(careerPath.target || ''),
        progress: Math.min(100, Math.max(0, Math.round(Number(careerPath.progress) || 0))),
      };
    }
    upsertUserMemoryRow(uid, {
      profileContent: profileContent ?? existing?.profile_content ?? '',
      errorLedger: errorLedger || existing?.error_ledger || '{}',
      memoryLayers: JSON.stringify(layers),
      updatedAt: now,
    });
    res.json({ success: true, data: { updated_at: now, memory_layers: layers } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

注意：若 `profileContent` 未传，保留 existing，避免误清空短板。

- [ ] **Step 3: 跑静态契约**

Run: `node vocab-server/tests/careerPathProfileSave.test.js`  
Expected: PASS

- [ ] **Step 4: Commit**（用户要求时）

```bash
git add vocab-server/server.js vocab-server/tests/careerPathProfileSave.test.js
git commit -m "feat(profile): persist career_path in memory_layers on save"
```

---

### Task 3: 前端账号级 career 同步 + load 还原

**Files:**
- Modify: `src/utils/profileHelper.ts`
- Modify: `src/utils/careerProgression.ts`（`writeCareerPath` 调用 sync）
- Modify: `vocab-server/tests/careerProgressionFrontend.test.js`

- [ ] **Step 1: 在 profileHelper 增加 sync / 从 layers 应用**

```ts
import {
  applyCareerPathLocal,
  parseCareerPath,
  type CareerPath,
  readCareerPath,
} from './careerProgression';

const MEMORY_LAYERS_KEY = 'user_memory_layers'; // 已存在则复用

export async function syncCareerToServer(career?: CareerPath): Promise<void> {
  const path = parseCareerPath(career ?? readCareerPath());
  try {
    // 同步更新本地 memory_layers 镜像
    let layers: Record<string, unknown> = {};
    try {
      layers = JSON.parse(localStorage.getItem(MEMORY_LAYERS_KEY) || '{}');
    } catch { layers = {}; }
    layers.career_path = path;
    localStorage.setItem(MEMORY_LAYERS_KEY, JSON.stringify(layers));

    await fetch('/api/user/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getAppUserId(),
        careerPath: path,
        // 不传 profileContent → 后端保留 existing 短板
      }),
    });
  } catch (e) {
    console.warn('[profileHelper] sync career failed:', e);
  }
}

export function applyCareerFromMemoryLayers(memoryLayers: unknown): void {
  if (!memoryLayers || typeof memoryLayers !== 'object') return;
  const raw = (memoryLayers as { career_path?: unknown }).career_path;
  if (!raw) return;
  applyCareerPathLocal(parseCareerPath(raw));
}
```

- [ ] **Step 2: 改 `writeCareerPath`**

```ts
export function writeCareerPath(data: CareerPath): CareerPath {
  const next = applyCareerPathLocal(data);
  // 动态 import 或在 profileHelper 中包装 saveCareerPath 供 UI 调用，避免循环依赖：
  // 推荐：UI 调用 saveCareerPathForAccount(next) 定义在 profileHelper
  return next;
}
```

**推荐避免循环依赖：**

- `careerProgression.writeCareerPath` 仍只写本地（改为内部调用 `applyCareerPathLocal`）。  
- 新增 `profileHelper.saveCareerPathForAccount(data)` = `applyCareerPathLocal` + `syncCareerToServer`。  
- `Sidebar` / Overlay 保存改为调用 `saveCareerPathForAccount`。

- [ ] **Step 3: `loadUserProfileFromServer` 在写入 memory_layers 后调用 `applyCareerFromMemoryLayers(memory_layers)`**

- [ ] **Step 4: 扩展前端契约测试**

```js
assert.match(sidebar, /saveCareerPathForAccount|syncCareerToServer/, '侧栏保存必须同步账号 career');
```

- [ ] **Step 5: Sidebar 保存按钮**

将 `writeCareerPath(careerEditData)` 改为：

```ts
import { saveCareerPathForAccount } from '../utils/profileHelper';
// ...
const next = await saveCareerPathForAccount(careerEditData);
// 若 saveCareerPathForAccount 同步返回 CareerPath：
setCareerPath(next);
```

`saveCareerPathForAccount` 可先本地返回再 `void syncCareerToServer`。

- [ ] **Step 6: 跑测试**

```bash
node vocab-server/tests/careerProgressionFrontend.test.js
npx tsx --test src/utils/careerProgression.test.ts
```

Expected: PASS

---

### Task 4: injectUserProfile 前置职业行

**Files:**
- Modify: `src/utils/profileHelper.ts`（`injectUserProfile`）
- Create 或扩展: `src/utils/profileHelper.careerInject.test.ts`（纯函数测 format + 拼接逻辑可抽 `buildProfileInjectParts`）

- [ ] **Step 1: 抽拼接辅助（便于测）**

```ts
export function buildCareerAwareProfileString(baseProfile: string, career = readCareerPath()): string {
  const careerLine = formatCareerProfileLine(career);
  const rest = String(baseProfile || '').trim();
  // 去掉旧职业行再拼，保证最新时效覆盖
  const stripped = rest
    .split(/;\s*/)
    .filter((p) => !p.startsWith('职业路径:'))
    .join('; ');
  return [careerLine, stripped].filter(Boolean).join('; ');
}
```

- [ ] **Step 2: 测试**

```ts
test('buildCareerAwareProfileString 用新职业覆盖旧职业行', () => {
  const out = buildCareerAwareProfileString(
    '职业路径: 起点=旧; 当前=旧; 目标=旧; 能力匹配度=10%; 短板A',
    { history: 'H', current: 'C', target: 'T', progress: 23 },
  );
  assert.equal(out.includes('能力匹配度=23%'), true);
  assert.equal(out.includes('能力匹配度=10%'), false);
  assert.equal(out.includes('短板A'), true);
});
```

- [ ] **Step 3: 改 injectUserProfile**

在合并前：

```ts
const profile = buildCareerAwareProfileString(getUserCurrentProfile());
// 原 mergedProfile 用该 profile 作为第一段
const mergedProfile = [profile, l3Line, errorSummary, graphLine, recallLine, incomingProfile]
  .filter(Boolean)
  .join('; ');
```

同时：对 `incomingProfile` 也建议 strip 旧「职业路径:」以免重复（可选，最小可只 strip base）。

- [ ] **Step 4: 跑测试 PASS**

- [ ] **Step 5: 更新契约** `careerProgressionFrontend.test.js`：

```js
const profileHelper = fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8');
assert.match(profileHelper, /formatCareerProfileLine|buildCareerAwareProfileString/, 'inject 必须带职业路径');
```

---

### Task 5: 全局最新时效 — 短板增量走 Dedupe

**Files:**
- Modify: `src/utils/profileHelper.ts`（`appendUserProfileFactor`）
- Modify: `src/components/SummaryArea.tsx` / `WeeklyChatModule.tsx` / `BiweeklyReviewModal.tsx`（若改为 async，统一 await）
- Create: `vocab-server/tests/profileAppendFreshnessContract.test.js`

- [ ] **Step 1: 契约测试**

```js
const helper = fs.readFileSync(path.join(__dirname, '../../src/utils/profileHelper.ts'), 'utf8');
// appendUserProfileFactor 必须触发 ingest（profileDelta）或 compress，禁止仅 writeProfileLocal 无合并说明
assert.match(helper, /function appendUserProfileFactor|export function appendUserProfileFactor/);
assert.match(helper, /ingestUserMemory|profileDelta/, '增量必须走 ingest dedupe');
console.log('OK profile append freshness contract');
```

- [ ] **Step 2: 改 `appendUserProfileFactor`**

```ts
export function appendUserProfileFactor(newFactorsStr: string) {
  if (!newFactorsStr) return;
  // 乐观：仍可本地粗拼；权威：ingest 合并回写
  void ingestUserMemory({
    source: 'profile_factor_append',
    profileDelta: String(newFactorsStr).trim(),
  }).then(() => {
    window.dispatchEvent(new Event('global-profile-changed'));
  });
}
```

若调用方已同时 `ingestUserMemory` + `appendUserProfileFactor`，去掉重复 ingest：  
- **SummaryArea / WeeklyChatModule / BiweeklyReviewModal**：只保留一处 `ingestUserMemory({ profileDelta })`，删除紧邻的 `appendUserProfileFactor` **或** 让 `appendUserProfileFactor` 成为唯一入口并删除组件内重复 ingest。

推荐最终形态：组件只调 `appendUserProfileFactor`；其内部唯一负责 ingest；组件里原有 `ingestUserMemory` 的 `profileDelta` 去掉，其它 episode/session 字段仍保留在组件的 ingest（若仍需要）——若一次 ingest 即可带齐，合并为单次调用。

最小安全改法：

1. `appendUserProfileFactor` 改为只 `ingestUserMemory({ source, profileDelta })`。  
2. 组件中删除 `appendUserProfileFactor` 旁重复的 `profileDelta` 字段，保留 episode 等其它 ingest；或删除整次重复 ingest，改为先 append 再另一次 ingest 无 profileDelta。

- [ ] **Step 3: 跑契约**

Run: `node vocab-server/tests/profileAppendFreshnessContract.test.js`  
Expected: PASS

---

### Task 6: UserProfileOverlay（P1 + S1 Loading）

**Files:**
- Create: `src/components/UserProfileOverlay.tsx`
- Modify: `src/App.tsx` 或仅由 `GlobalSettingsPanel` portal 渲染

- [ ] **Step 1: 组件骨架**

```tsx
// UserProfileOverlay.tsx
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  compressUserProfile,
  getStoredProfileRawForEdit, // 若未导出：用 getUserCurrentProfile 或新增 getStoredProfileRaw export
  saveUserCurrentProfile,
  saveCareerPathForAccount,
  buildCareerAwareProfileString,
} from '../utils/profileHelper';
import { readCareerPath, type CareerPath } from '../utils/careerProgression';

type Phase = 'compressing' | 'ready' | 'error';

export default function UserProfileOverlay({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('compressing');
  const [compressMeta, setCompressMeta] = useState('');
  const [draftProfile, setDraftProfile] = useState('');
  const [career, setCareer] = useState<CareerPath>(() => readCareerPath());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('compressing');
    setError('');
    (async () => {
      try {
        const raw = (localStorage.getItem('user_current_profile') || '').trim();
        if (!raw) {
          if (!cancelled) {
            setDraftProfile('');
            setCareer(readCareerPath());
            setPhase('ready');
          }
          return;
        }
        const result = await compressUserProfile(raw, true); // S1 自动落库
        if (cancelled) return;
        setDraftProfile(result.mergedProfile);
        setCompressMeta(`已 AI 精简 · ${result.beforeLength}→${result.afterLength} 字 · 合并 ${result.dedupeCount} 处`);
        setCareer(readCareerPath());
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setError('精简失败，已打开当前落库内容');
        setDraftProfile(localStorage.getItem('user_current_profile') || '');
        setCareer(readCareerPath());
        setPhase('ready');
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const preview = buildCareerAwareProfileString(draftProfile, career);

  return createPortal(
    <div className="fixed inset-0 z-[1100] ...">
      {phase === 'compressing' && (
        <div>正在概括并精简画像… <button type="button" onClick={onClose}>取消</button></div>
      )}
      {phase === 'ready' && (
        <>
          {/* 顶栏返回 / 角标 compressMeta / error */}
          {/* 左：career 四字段 */}
          {/* 右：textarea draftProfile + 再次精简 + 清空 */}
          {/* 注入预览 preview */}
          {/* 取消 / 保存：saveUserCurrentProfile(draft); saveCareerPathForAccount(career); onClose(); */}
        </>
      )}
    </div>,
    document.body,
  );
}
```

UI 样式对齐现有 `ProfileEditModal` + 全局设置深色/白卡片风格；职业字段布局可参考 `Sidebar` 编辑态。

- [ ] **Step 2: 「再次精简」** 调用 `compressUserProfile(draftProfile, true)` 后刷新 draft 与 meta。

- [ ] **Step 3: 清空** 确认后 `saveUserCurrentProfile('')`，draft 置空（职业不动）。

- [ ] **Step 4: 挂载** — `GlobalSettingsPanel` 内 `useState` 控制 `profileOpen`，或 `App.tsx` 事件总线。推荐 Settings 内状态：

```tsx
const [profileOverlayOpen, setProfileOverlayOpen] = useState(false);
// 打开时：setIsOpen(false); setProfileOverlayOpen(true);
```

---

### Task 7: 全局设置入口

**Files:**
- Modify: `src/components/GlobalSettingsPanel.tsx`

- [ ] **Step 1: 在「地区画像偏好」与「用户标识」之间（或用户标识后）插入区块**

```tsx
import { readCareerPath, careerNodeLabel } from '../utils/careerProgression';
import { getUserWeaknessProfile } from '../utils/profileHelper';
import UserProfileOverlay from './UserProfileOverlay';

// 预览
const career = readCareerPath();
const preview = `${careerNodeLabel(career.current)}→${careerNodeLabel(career.target)} · ${career.progress}%`;

// UI
<div>
  <label>当前账号画像</label>
  <p className="text-[9px] text-gray-500 truncate">{preview}</p>
  <p className="text-[9px] text-gray-500 truncate">{getUserWeaknessProfile() || '暂无短板'}</p>
  <button
    type="button"
    onClick={() => {
      playClick();
      setIsOpen(false);           // 关闭全局设置
      setProfileOverlayOpen(true); // 打开 Overlay（内部先 compress）
    }}
  >
    打开
  </button>
</div>
<UserProfileOverlay open={profileOverlayOpen} onClose={() => setProfileOverlayOpen(false)} />
```

- [ ] **Step 2: 契约**

```js
const settings = fs.readFileSync(..., 'GlobalSettingsPanel.tsx', 'utf8');
assert.match(settings, /UserProfileOverlay/);
assert.match(settings, /setIsOpen\(false\)/);
```

---

### Task 8: 端到端验收（手工 + 自动化）

- [ ] **Step 1: 自动化合集**

```bash
node vocab-server/tests/careerProgressionFrontend.test.js
node vocab-server/tests/careerPathProfileSave.test.js
node vocab-server/tests/profileAppendFreshnessContract.test.js
npx tsx --test src/utils/careerProgression.test.ts
# 若有 profileHelper.careerInject.test.ts 一并跑
```

Expected: 全部 PASS

- [ ] **Step 2: 手工功能 1 — 职业入账号并注入**

菜单：侧栏 Career → 编辑目标/23% → 保存并推演  
预期：SQLite/GET profile 含 `memory_layers.career_path`；任意生成请求的 `user_current_profile` 含 `能力匹配度=23%`（DevTools 或后端日志）

- [ ] **Step 3: 手工功能 2 — 全局设置 S1**

路径：右下角全局设置 → 打开画像  
预期：设置关闭 → Loading → 短板变短已落库 → P1 可编辑；保存后顶栏 Evolution 同步

- [ ] **Step 4: 手工功能 3 — 最新时效**

先写入短板主题旧句，再写入同主题新句（周聊或二次精简）  
预期：画像中只留新句

- [ ] **Step 5: 手工功能 4 — 账号隔离**

用户 A 设职业 → 全局设置改 User ID 为 B → 再改回 A  
预期：A 的 career 恢复，不与 B 串扰

- [ ] **Step 6: 更新设计文档状态** 为「已实现」或保留「实现中」（实现完成后）

---

## Spec coverage 自检

| Spec 要求 | Task |
|-----------|------|
| 职业写入账号画像 | Task 2–3 |
| Dify inject 含职业 | Task 4 |
| 全局设置打开画像 | Task 6–7 |
| S1 进入精简落库 | Task 6 |
| 全局最新时效 | Task 4 strip 旧职业行 + Task 5 ingest dedupe |
| 方案 A 不重跑材料 | 全任务无重生成调用 |
| 职业不送 LLM 压缩 | Task 6 只 compress 短板正文 |
| 账号隔离 | Task 3 load 还原 career |

## Placeholder 自检

无 TBD；R1（`memory_layers.career_path`）已锁定；commit 步骤标明「用户要求时」。

## 类型一致性

- `CareerPath`：`history/current/target/progress`  
- 服务端键：`memory_layers.career_path`  
- UI 保存账号：`saveCareerPathForAccount`  
- 注入：`formatCareerProfileLine` / `buildCareerAwareProfileString`

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-29-career-profile-dify-linkage.md`.**

两种执行方式：

1. **Subagent-Driven（推荐）** — 每任务派生子代理，任务间复查  
2. **Inline Execution** — 本会话按 executing-plans 逐任务执行并设检查点  

请选一种；确认后我再开始改代码。
