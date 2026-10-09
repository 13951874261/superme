# 账号登录、隔离与生成恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让受邀账号使用可重复令牌安全登录，只能退出后换号，并保持画像、学习数据及四项生成资产严格按账号隔离。

**Architecture:** Cookie session 是唯一服务端身份；前端 localStorage 仅缓存当前/上次账号用于展示和本地分桶。认证成功后直接水合认证账号，禁止在新 Cookie 下 flush 旧账号。现有四项生成算法不改，缺缓存继续由用户手动触发。

**Tech Stack:** React 19、TypeScript、Express、SQLite、Node.js `node:test`

---

## 文件职责与修改范围

- `vocab-server/services/authService.js`：验证可重复令牌、签发与撤销 Cookie session。
- `vocab-server/tests/inviteTokenAuth.test.js`：认证行为回归测试。
- `vocab-server/scripts/invite-account.js`：邀请管理与统一数据库路径。
- `vocab-server/tests/inviteAccount.test.js`：邀请脚本、登录页、路径契约测试。
- `vocab-server/scripts/check-user-daily-readiness.js`：精确账号诊断与统一数据库路径。
- `vocab-server/scripts/test-check-user-daily-readiness.js`：诊断行为测试。
- `src/utils/profileHelper.ts`：认证登录只水合目标账号，不 flush 旧账号。
- `src/utils/switchAccountSession.e2e-contract.test.ts`：认证水合与账号切换隔离测试。
- `src/components/LoginPage.tsx`：上次账号、可重复令牌说明。
- `src/components/GlobalSettingsPanel.tsx`：移除直接改号，增加退出入口。
- `src/App.tsx`：统一退出状态切换。
- `src/services/authAPI.ts`：复用现有 `logout()`。
- `vocab-server/tests/inviteAccount.test.js`：前端静态契约覆盖登录指导与退出换号。

### Task 1：可重复登录令牌

**Files:**
- Modify: `vocab-server/tests/inviteTokenAuth.test.js:85-109`
- Modify: `vocab-server/services/authService.js:34-55`

- [ ] **Step 1：先改测试，要求同一令牌可重复登录**

将“一次兑换”测试改为：同一账号、同一令牌连续调用两次 `/api/auth/login` 均返回 200；两个 Cookie 均可访问 `/api/auth/session`；`redeemed_at` 已记录。

```javascript
test('有效登录令牌可重复登录并签发独立 cookie session', async () => {
  const f = await fixture();
  try {
    const issued = issue(f);
    const first = await login(f, 'alice', issued.inviteToken);
    const second = await login(f, 'alice', issued.inviteToken);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const firstCookie = first.headers.get('set-cookie');
    const secondCookie = second.headers.get('set-cookie');
    assert.notEqual(firstCookie, secondCookie);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: firstCookie } })).status, 200);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: secondCookie } })).status, 200);
    assert.equal(f.db.prepare('SELECT redeemed_at FROM invited_accounts WHERE user_id = ?').get('alice').redeemed_at !== null, true);
  } finally { f.close(); }
});
```

将并发测试改为两个请求均成功并产生两个 session：

```javascript
test('并发使用有效登录令牌均成功', async () => {
  const f = await fixture();
  try {
    const issued = issue(f);
    const responses = await Promise.all([
      login(f, 'alice', issued.inviteToken),
      login(f, 'alice', issued.inviteToken),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM auth_sessions WHERE user_id = ?').get('alice').n, 2);
  } finally { f.close(); }
});
```

- [ ] **Step 2：运行测试，确认 RED**

Run: `node --test vocab-server/tests/inviteTokenAuth.test.js`

Expected: 两个新测试失败；第二次登录返回 401。

- [ ] **Step 3：最小修改令牌验证**

在 `authService.login()` 中移除 `row.redeemed_at == null` 限制；首次成功时用 `COALESCE` 记录审计时间，不覆盖已有时间；删除事务内“仅一次更新”门槛。

```javascript
const row = db.prepare('SELECT invite_token_hash, redeemed_at FROM invited_accounts WHERE user_id = ?').get(normalized);
const expectedHash = Buffer.from(row?.invite_token_hash || '0'.repeat(64), 'hex');
const valid = expectedHash.length === suppliedHash.length
  && crypto.timingSafeEqual(expectedHash, suppliedHash)
  && row?.invite_token_hash
  && String(inviteToken || '').length > 0;
if (!valid) { db.exec('ROLLBACK'); return null; }
db.prepare('UPDATE invited_accounts SET redeemed_at = COALESCE(redeemed_at, ?) WHERE user_id = ?').run(now, normalized);
```

- [ ] **Step 4：运行认证测试，确认 GREEN**

Run: `node --test vocab-server/tests/inviteTokenAuth.test.js`

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add vocab-server/services/authService.js vocab-server/tests/inviteTokenAuth.test.js
git commit -m "fix: allow reusable login tokens"
```

### Task 2：统一数据库路径

**Files:**
- Modify: `vocab-server/tests/inviteAccount.test.js`
- Modify: `vocab-server/scripts/test-check-user-daily-readiness.js`
- Modify: `vocab-server/scripts/invite-account.js:8-14`
- Modify: `vocab-server/scripts/check-user-daily-readiness.js:5-18`
- Modify: `vocab-server/server.js:137-149`

- [ ] **Step 1：先写路径优先级测试**

在邀请脚本测试中增加：

```javascript
test('数据库路径优先级统一', () => {
  const scriptDir = path.join(path.sep, 'var', 'www', 'super-agent', 'vocab-server', 'scripts');
  assert.equal(script.resolveDatabasePath({
    env: { SUPER_AGENT_DB_PATH: '/data/new.db', VOCAB_DB_PATH: '/data/old.db' },
    scriptDir,
  }), path.resolve('/data/new.db'));
  assert.equal(script.resolveDatabasePath({
    env: { VOCAB_DB_PATH: '/data/old.db' },
    scriptDir,
  }), path.resolve('/data/old.db'));
  assert.equal(script.resolveDatabasePath({ env: { NODE_ENV: 'production' }, scriptDir }), '/var/lib/super-agent/vocab.db');
});
```

在诊断脚本测试中增加相同三项断言。对 `server.js` 增加静态断言：`SUPER_AGENT_DB_PATH || process.env.VOCAB_DB_PATH || '/var/lib/super-agent/vocab.db'`。

- [ ] **Step 2：运行测试，确认 RED**

Run: `node --test vocab-server/tests/inviteAccount.test.js vocab-server/scripts/test-check-user-daily-readiness.js`

Expected: `SUPER_AGENT_DB_PATH` 优先级或生产默认值断言失败。

- [ ] **Step 3：最小统一路径解析**

邀请脚本、诊断脚本统一：

```javascript
const PRODUCTION_DB_PATH = '/var/lib/super-agent/vocab.db';

function resolveDatabasePath({ env = process.env, scriptDir = __dirname } = {}) {
  if (env.SUPER_AGENT_DB_PATH) return path.resolve(env.SUPER_AGENT_DB_PATH);
  if (env.VOCAB_DB_PATH) return path.resolve(env.VOCAB_DB_PATH);
  const normalizedDir = String(scriptDir).replace(/\\/g, '/');
  const isProduction = env.NODE_ENV === 'production' || normalizedDir.includes('/var/www/') || normalizedDir.includes('/opt/');
  return isProduction ? PRODUCTION_DB_PATH : path.resolve(scriptDir, '..', 'vocab.db');
}
```

服务端改为：

```javascript
const dbPath = isProd
  ? (process.env.SUPER_AGENT_DB_PATH || process.env.VOCAB_DB_PATH || '/var/lib/super-agent/vocab.db')
  : (process.env.SUPER_AGENT_DB_PATH || process.env.VOCAB_DB_PATH || path.join(__dirname, 'vocab.db'));
```

- [ ] **Step 4：运行路径测试，确认 GREEN**

Run: `node --test vocab-server/tests/inviteAccount.test.js vocab-server/scripts/test-check-user-daily-readiness.js`

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add vocab-server/server.js vocab-server/scripts/invite-account.js vocab-server/scripts/check-user-daily-readiness.js vocab-server/tests/inviteAccount.test.js vocab-server/scripts/test-check-user-daily-readiness.js
git commit -m "fix: unify account database paths"
```

### Task 3：认证水合禁止跨账号 flush

**Files:**
- Modify: `src/utils/switchAccountSession.e2e-contract.test.ts`
- Modify: `src/utils/profileHelper.ts:903-951`
- Modify: `src/App.tsx:398-404`
- Modify: `src/components/LoginPage.tsx:141-145`

- [ ] **Step 1：先写认证水合隔离测试**

在 e2e 契约测试中加入认证模式：旧账号本地 learning UI 存在；调用认证水合 `initializeAuthenticatedUserSession('alice')`；断言没有向 `/api/user/learning-ui` 发出旧账号 PUT，只发出目标账号 GET，并将本地账号设为 `alice`。

```typescript
test('认证水合不在新 cookie 下 flush 旧账号', async () => {
  // 复用本文件 window/localStorage/fetch fixture
  localStorage.setItem('super_agent_user_id', 'lzhmy');
  localStorage.setItem(learnKey('lzhmy', 'learning_ui_state'), JSON.stringify({ old: true }));
  const requests: Array<{ method: string; body: string }> = [];
  globalThis.fetch = async (_url, init = {}) => {
    requests.push({ method: init.method || 'GET', body: String(init.body || '') });
    return new Response(JSON.stringify({ success: true, profileContent: '', learningUi: {} }), { status: 200 });
  };
  const { initializeAuthenticatedUserSession } = await import('./profileHelper.ts');
  await initializeAuthenticatedUserSession('alice');
  assert.equal(localStorage.getItem('super_agent_user_id'), 'alice');
  assert.equal(requests.some((request) => request.method === 'PUT'), false);
});
```

- [ ] **Step 2：运行测试，确认 RED**

Run: `npx tsx --test src/utils/switchAccountSession.e2e-contract.test.ts`

Expected: `initializeAuthenticatedUserSession` 不存在。

- [ ] **Step 3：实现认证专用水合**

在 `profileHelper.ts` 添加最小函数：

```typescript
export async function initializeAuthenticatedUserSession(userId: string): Promise<string> {
  const next = sanitizeUserId(userId);
  setAppUserId(next, { dispatch: false });
  clearSessionKeysOnSwitch(next);
  const { loadLearningUiFromServer } = await import('../services/learningUiAPI');
  await Promise.all([
    loadUserProfileFromServer(next),
    loadLearningUiFromServer(next),
  ]);
  dispatchUserIdChanged();
  await recordUserLoginPing(next);
  return next;
}
```

`App.tsx` 与 `LoginPage.tsx` 的认证入口改用该函数。保留 `switchAccountSession()` 供非认证内部测试，生产设置入口在 Task 5 删除。

- [ ] **Step 4：运行隔离测试，确认 GREEN**

Run: `npx tsx --test src/utils/switchAccountSession.e2e-contract.test.ts src/utils/switchAccountSession.contract.test.ts src/utils/profileIsolation.test.ts`

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add src/utils/profileHelper.ts src/App.tsx src/components/LoginPage.tsx src/utils/switchAccountSession.e2e-contract.test.ts
git commit -m "fix: hydrate authenticated accounts safely"
```

### Task 4：登录页后续登录指导

**Files:**
- Modify: `vocab-server/tests/inviteAccount.test.js`
- Modify: `src/components/LoginPage.tsx:30-34,239-320`

- [ ] **Step 1：先写登录提示契约测试**

```javascript
test('登录页显示上次账号和可重复令牌指导', () => {
  const login = read('src/components/LoginPage.tsx');
  assert.match(login, /上次登录账号/);
  assert.match(login, /登录令牌可重复使用/);
  assert.match(login, /联系管理员重新签发/);
  assert.doesNotMatch(login, /localStorage\.setItem\([^)]*(invite|token)/i);
});
```

- [ ] **Step 2：运行测试，确认 RED**

Run: `node --test vocab-server/tests/inviteAccount.test.js`

Expected: 缺少三段指导文案。

- [ ] **Step 3：最小修改登录 UI**

在组件初始化时保存 `lastAccount`，输入框仍预填该值。在账号输入框上方增加：

```tsx
{lastAccount && (
  <p className="mb-3 text-xs text-ink-muted">
    上次登录账号：<strong className="text-ink-secondary">{lastAccount}</strong>
  </p>
)}
```

令牌输入框下方增加：

```tsx
<p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
  登录令牌可重复使用，请妥善保管；忘记或失效请联系管理员重新签发。
</p>
```

将标签“邀请令牌”改为“登录令牌”，`autoComplete` 改为 `current-password`，不增加任何令牌存储。

- [ ] **Step 4：运行测试，确认 GREEN**

Run: `node --test vocab-server/tests/inviteAccount.test.js`

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add src/components/LoginPage.tsx vocab-server/tests/inviteAccount.test.js
git commit -m "feat: clarify returning account login"
```

### Task 5：删除直接改号并增加退出登录

**Files:**
- Modify: `vocab-server/tests/inviteAccount.test.js`
- Modify: `src/components/GlobalSettingsPanel.tsx:1-80,184-229`
- Modify: `src/App.tsx:41-390,392-434`

- [ ] **Step 1：先写退出换号契约测试**

```javascript
test('设置页只能退出后换号', () => {
  const settings = read('src/components/GlobalSettingsPanel.tsx');
  const app = read('src/App.tsx');
  assert.doesNotMatch(settings, /switchAccountSession/);
  assert.doesNotMatch(settings, /保存用户标识/);
  assert.match(settings, /当前登录账号/);
  assert.match(settings, /退出登录/);
  assert.match(settings, /onLogout/);
  assert.match(app, /await logout\(\)/);
  assert.match(app, /setIsAuthenticated\(false\)/);
});
```

- [ ] **Step 2：运行测试，确认 RED**

Run: `node --test vocab-server/tests/inviteAccount.test.js`

Expected: 设置仍包含直接改号；App 尚无退出处理。

- [ ] **Step 3：实现最小退出流程**

`GlobalSettingsPanel` 改为接收：

```typescript
interface GlobalSettingsPanelProps {
  currentUserId: string;
  onLogout: () => Promise<void>;
}
```

删除 `userIdDraft`、直接改号状态及 `handleSaveUserId()`。原 User ID 折叠区替换为只读账号与退出按钮：

```tsx
<div className="space-y-3 bg-gray-800/50 p-3 rounded-xl border border-gray-700">
  <p className="text-[10px] text-gray-400">当前登录账号</p>
  <p className="font-mono text-xs text-white break-all">{currentUserId}</p>
  <button type="button" onClick={() => void onLogout()} className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-black uppercase tracking-widest text-white">
    退出登录
  </button>
  <p className="text-[9px] text-gray-500">切换账号需先退出，再使用另一账号及登录令牌登录。</p>
</div>
```

在 `App` 顶层定义：

```typescript
const handleLogout = useCallback(async () => {
  await logout();
  setIsAuthenticated(false);
}, []);
```

将 `currentUserId`、`onLogout` 传入 `AppContent`，再传入 `GlobalSettingsPanel`。退出失败由 `GlobalSettingsPanel` 捕获并显示“退出失败，请重试”，不修改认证状态。

- [ ] **Step 4：运行测试与类型检查，确认 GREEN**

Run: `node --test vocab-server/tests/inviteAccount.test.js && npm run lint`

Expected: 全部通过，TypeScript 无错误。

- [ ] **Step 5：提交**

```bash
git add src/App.tsx src/components/GlobalSettingsPanel.tsx vocab-server/tests/inviteAccount.test.js
git commit -m "fix: require logout before account switch"
```

### Task 6：验证四项按账号隔离、缺失时仅手动生成

**Files:**
- Test only: existing daily pack/listen/long-article tests
- Modify only if a test proves regression in directly scoped behavior

- [ ] **Step 1：运行现有账号与 daily-pack 隔离测试**

Run:

```bash
npx tsx --test src/utils/accountStorage.test.ts src/utils/profileIsolation.test.ts src/utils/reviewIsolation.test.ts src/utils/moduleKeyIsolation.test.ts
node --test vocab-server/scripts/test-cron-target-users.js vocab-server/tests/longArticleQueryWithoutProfileContract.test.js vocab-server/tests/dailyPackTaskCenterHandoff.test.js
```

Expected: 全部通过；`lzhmy`、`lzhumy` 不合并。

- [ ] **Step 2：静态验证登录不触发四项生成**

Run: `rg "regenerateDailyPack|daily-extract|sync-long-article-to-listen" src/components/LoginPage.tsx src/App.tsx src/utils/profileHelper.ts`

Expected: 无匹配。

- [ ] **Step 3：验证现有手动入口仍存在**

Run: `rg "regenerateDailyPack|syncLongArticleToListen|刷新今日包|刷新词汇" src/components/modules/DailyWakeupModule.tsx src/components/modules/DailyErrorVocabularyModule.tsx src/components/modules/english/tabs/DashboardTab.tsx src/components/modules/english/tabs/ListenTab.tsx`

Expected: 唤醒、破绽、长文、音频手动路径均有匹配。

- [ ] **Step 4：若无回归，不改四项业务文件**

Expected: 保持最小 diff；不新增自动补生成。

### Task 7：全量验证与对抗式审查

**Files:**
- Verify all changed files

- [ ] **Step 1：运行认证、脚本、隔离测试**

```bash
node --test vocab-server/tests/inviteTokenAuth.test.js vocab-server/tests/inviteAccount.test.js vocab-server/scripts/test-check-user-daily-readiness.js vocab-server/scripts/test-cron-target-users.js
npx tsx --test src/utils/switchAccountSession.e2e-contract.test.ts src/utils/switchAccountSession.contract.test.ts src/utils/accountStorage.test.ts src/utils/profileIsolation.test.ts
```

Expected: 全部通过。

- [ ] **Step 2：运行类型检查**

Run: `npm run lint`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 3：运行生产构建**

Run: `npm run build`

Expected: Vite 构建成功。

- [ ] **Step 4：对抗式代码审查**

检查：

- 是否仍存在普通用户可调用的 `switchAccountSession` UI；
- 是否有令牌明文持久化或日志；
- `reissue/remove` 是否继续撤销 session；
- 退出失败是否错误地进入登录页；
- 服务与脚本路径是否一致；
- `lzhumy`/`lzhmy` 是否在生产业务路由被合并；
- 登录是否意外触发生成。

发现问题：先写最小失败测试，再修复并重新执行 Step 1-3。

- [ ] **Step 5：输出功能测试案例**

按设计规格五个测试用例报告：菜单路径、测试数据、预期结果、实际结果、对应需求。
