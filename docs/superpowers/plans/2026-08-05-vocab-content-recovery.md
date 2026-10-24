# 词库内容恢复与紧凑展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复词库分类错位、分区分页和复习队列重复问题，使生词本与词汇矩阵稳定显示当前分区的真实内容。

**Architecture:** 先将 SQLite 存量分类归一化并修正所有批量入库路径；随后让 list/review 接口在服务端完成分区过滤和 offset 分页。前端以同一分区参数请求列表和复习队列，并在网络失败时保留缓存卡片而非清空页面。

**Tech Stack:** Node.js 20、Express、better-sqlite3、React 19、TypeScript、Vite、Node test runner。

---

## 文件结构与责任

- `vocab-server/server.js`
  - 存量 `category` 归一化迁移。
  - `/list`、`/review` 的 category + offset 分页。
  - 批量素材、每日提取、句型入库时固定写 `business`。
- `src/services/vocabAPI.ts`
  - 为分页请求添加分区和 review offset。
  - 为缓存增加分区隔离，避免 business/general 串数据。
- `src/components/VocabularyBook.tsx`
  - 列表和待复习队列请求当前分区，不再客户端二次过滤。
  - 不用 50 条预加载队列覆盖 stats。
- `src/components/modules/english/tabs/VocabTab.tsx`
  - 复习请求携带当前分区，保留缓存，失败后重试一次并显示状态。
- `src/components/FlashCard.tsx`
  - 使用递增 offset 请求后续复习批次。
- `src/services/vocabAPI.test.ts`
  - 覆盖 API 分页 URL、参数边界和分区缓存 key。

## Task 1: 后端数据归一化与分区分页

**Files:**
- Modify: `vocab-server/server.js:2921-2987`
- Modify: `vocab-server/server.js` 数据库初始化位置（紧邻现有 schema/index 初始化）

- [ ] **Step 1: 新增一次性、幂等的历史分类归一化**

在数据库初始化完成后执行以下语句，并记录受影响行数：

```js
const normalizedCategories = db.prepare(`
  UPDATE vocabulary
  SET category = 'business'
  WHERE category IS NULL OR category NOT IN ('business', 'general')
`).run();

if (normalizedCategories.changes > 0) {
  console.log(`[Vocab] normalized ${normalizedCategories.changes} legacy categories to business`);
}
```

该语句只能在启动初始化阶段执行，不得放入请求处理器；它不会修改 `general`、payload、复习历史或 SM-2 字段。

- [ ] **Step 2: 为 list/review 定义统一的分区参数校验**

在 `LIGHT_SELECT` 附近添加只接受两个有效值的解析器：

```js
function parseVocabCategory(value) {
  return value === 'business' || value === 'general' ? value : null;
}
```

`category` 缺失时维持既有全量导出兼容性；当 light 分页请求携带 category 时必须传入 SQL 条件，不得在返回 JSON 后过滤。

- [ ] **Step 3: 修改 `/api/vocab/list` 的 SQL 分区分页**

把分页分支改为按是否有分区选择查询：

```js
const category = parseVocabCategory(req.query.category);
const rows = category
  ? db.prepare(`
      SELECT ${LIGHT_SELECT}
      FROM vocabulary
      WHERE category = ?
      ORDER BY added_at DESC
      LIMIT ? OFFSET ?
    `).all(category, pageSize + 1, offset)
  : db.prepare(`
      SELECT ${LIGHT_SELECT}
      FROM vocabulary
      ORDER BY added_at DESC
      LIMIT ? OFFSET ?
    `).all(pageSize + 1, offset);
```

保留 `items: rows.slice(0, pageSize)` 和 `hasMore: rows.length > pageSize`，使 `hasMore` 与同一分区结果集一致。

- [ ] **Step 4: 修改 `/api/vocab/review` 的 SQL 分区 + offset 分页**

解析 `offset` 和 category；在查询中添加相同分区条件：

```js
const offset = Math.max(0, Number(req.query.offset) || 0);
const category = parseVocabCategory(req.query.category);
const rows = category
  ? db.prepare(`
      SELECT ${LIGHT_SELECT}
      FROM vocabulary
      WHERE next_review_date <= ? AND repetitions < 999 AND category = ?
      ORDER BY next_review_date ASC
      LIMIT ? OFFSET ?
    `).all(now, category, pageSize + 1, offset)
  : db.prepare(`
      SELECT ${LIGHT_SELECT}
      FROM vocabulary
      WHERE next_review_date <= ? AND repetitions < 999
      ORDER BY next_review_date ASC
      LIMIT ? OFFSET ?
    `).all(now, pageSize + 1, offset);
```

排序必须保持 `next_review_date ASC`；接口返回形状仍为 `{ items, hasMore }`。

- [ ] **Step 5: 本机验证接口语义**

启动隔离的本地服务后执行：

```powershell
curl.exe "http://127.0.0.1:3001/api/vocab/list?light=1&category=business&limit=2&offset=0"
curl.exe "http://127.0.0.1:3001/api/vocab/review?light=1&category=business&limit=2&offset=0"
curl.exe "http://127.0.0.1:3001/api/vocab/review?light=1&category=business&limit=2&offset=2"
```

预期：每个响应只有当前 category 的 items；第二个 review 页面与第一个页面没有重复 id；空分区返回 `items: []` 与 `hasMore: false`。

## Task 2: 修复所有批量入库的 category 语义

**Files:**
- Modify: `vocab-server/server.js:5007-5066`
- Modify: `vocab-server/server.js:5951-6018`

- [ ] **Step 1: 让素材提取词条和句型把 topic 写入 payload**

在素材提取循环中构造 payload 时保留主题：

```js
payload = { ...payload, topic: payload.topic || topic || '' };
```

将词条 insert 和已有词条 update 的 category 参数都替换为 `'business'`：

```js
).run(id, wordStr, dictType, 'business', JSON.stringify(payload), now, now, '[]');

db.prepare('UPDATE vocabulary SET dict_type = ?, category = ?, payload = ? WHERE id = ?').run(
  dictType,
  'business',
  JSON.stringify(payload),
  existing.id
);
```

句型 insert 同样固定 category：

```js
).run(id, cleanSent, 'ai_sentence', 'business', JSON.stringify(sentPayload), now, now, '[]');
```

- [ ] **Step 2: 让每日提取的词、短语和句型固定写入 business**

保持各自 payload 中已有的 `topic` 字段；将三处 `.run` 的 category 参数替换为：

```js
'business'
```

覆盖 word、phrase、sentence 三条 insert 路径，避免新增任一内容类型再次写入 `daily_extraction` 或主题名。

- [ ] **Step 3: 对数据库执行归类回归检查**

在目标 SQLite 数据库执行：

```sql
SELECT category, COUNT(*) AS count
FROM vocabulary
GROUP BY category
ORDER BY count DESC;
```

预期：只存在 `business` 和可能已有的 `general`；不得再有 `daily_extraction`、`material_extraction` 或主题名称。

## Task 3: 扩展前端分页 API 与分区缓存

**Files:**
- Create: `src/services/vocabAPI.test.ts`
- Modify: `src/services/vocabAPI.ts:179-260`

- [ ] **Step 1: 先写失败测试，约束分区参数与 review offset**

在 `src/services/vocabAPI.test.ts` 中以可注入的 `globalThis.fetch` mock 覆盖请求，测试：

```ts
test('getReviewPage 将 category 与 offset 编入分页请求', async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [], hasMore: false }), { status: 200 });
  };

  await getReviewPage('business', 50, 100);

  assert.match(urls[0], /\/review\?light=1&category=business&limit=50&offset=100/);
});
```

并为 `getVocabPage('general', 50, 0)` 断言包含 `category=general`；为缓存断言 business 与 general 读取不同 sessionStorage key。

- [ ] **Step 2: 运行测试确认当前实现失败**

运行：

```powershell
npx tsx --test src/services/vocabAPI.test.ts
```

预期：因 `getReviewPage` 尚不接受 category/offset 或请求 URL 缺少这些参数而失败。

- [ ] **Step 3: 更新 API 类型、请求路径和 dedupe key**

新增分区类型并改为以下签名：

```ts
export type VocabCategory = 'business' | 'general';

export async function getVocabPage(
  category: VocabCategory,
  offset: number,
  limit = 50,
): Promise<VocabPage> { /* category + offset query */ }

export async function getReviewPage(
  category: VocabCategory,
  limit = 50,
  offset = 0,
): Promise<VocabPage> { /* category + offset query */ }
```

请求路径使用固定 query 顺序：

```ts
`/review?light=1&category=${category}&limit=${safeLimit}&offset=${safeOffset}`
```

dedupe key 必须含 category、limit 与 offset：

```ts
`review:page:${category}:${safeLimit}:${safeOffset}`
```

把 review 缓存 key 改为按分区隔离的函数：

```ts
function reviewLightCacheKey(category: VocabCategory) {
  return `sa_vocab_review_light_v1:${category}`;
}
```

`readReviewLightCache`、`writeReviewLightCache`、`clearReviewLightCache` 和 `getReviewWords` 均接收 category，避免在切换分区时显示另一分区的旧缓存。

- [ ] **Step 4: 运行 API 客户端测试**

运行：

```powershell
npx tsx --test src/services/vocabAPI.test.ts src/services/vocabRequestDeduper.test.ts src/services/vocabLoadCoordinator.test.ts
```

预期：三个测试文件全部通过。

## Task 4: 对齐生词本与词汇矩阵的数据源和失败态

**Files:**
- Modify: `src/components/VocabularyBook.tsx:172-255`
- Modify: `src/components/modules/english/tabs/VocabTab.tsx:86-163`

- [ ] **Step 1: 生词本按当前分区请求，不再客户端 filter**

将 `getVocabPage` 调用改为：

```ts
() => getVocabPage(vocabTab, append ? words.length : 0)
```

将 review 预热和刷新调用改为：

```ts
getReviewWords(vocabTab, { light: true })
```

删除 `setStats((prev) => ({ ...prev, dueToday: review.length }))` 的两处赋值；`dueToday` 只由 `loadStats()` 更新。`filteredWords` 与 `dueInZone` 直接使用服务端已分区的 `words`、`dueWords`，不再检查 `w.category`。

- [ ] **Step 2: 切换分区时重置列表并加载首批**

为分区切换事件增加以下顺序：

```ts
setWords([]);
setHasMoreWords(false);
setScrollTop(0);
loadWords(false);
```

确保 `loadWords` 的依赖包含 `vocabTab`，使 closure 使用切换后的分区。

- [ ] **Step 3: 词汇矩阵实现一次重试和缓存保留**

在 `VocabTab.tsx` 添加同步状态：

```ts
const [syncNotice, setSyncNotice] = useState<string | null>(null);
```

将请求抽为最多两次尝试：

```ts
const loadFreshReviewPage = async () => {
  try {
    return await getReviewWords(vocabZone, { light: true });
  } catch {
    return await getReviewWords(vocabZone, { light: true });
  }
};
```

第二次仍失败且存在当前分区缓存时，不调用 `setDueWords([])`，而是：

```ts
setDueWords(cached);
setSyncNotice(`网络暂不可用，正在使用上次同步的 ${cached.length} 个复习词。`);
```

没有缓存时设置明确错误提示；只有服务端成功返回空数组时才清空并展示“今日词汇已清空”。

- [ ] **Step 4: 将队列进度显示为真实位置**

在现有词汇矩阵卡片头部添加：

```tsx
<span className="text-xs text-slate-500">
  第 {currentWordIdx + 1} / {filteredWords.length} 个
</span>
```

在同步失败缓存分支旁显示 `syncNotice`，使用已有浅色提示样式，不能遮挡单词卡或操作按钮。

- [ ] **Step 5: 前端类型检查与手动验证**

运行：

```powershell
npm run lint
npm run build
```

预期：均以退出码 0 完成。浏览器验证：

1. 打开“艾宾浩斯生词本”，政商务区显示词条和待复习数。
2. 切换全场景区，列表和“加载更多”基于该区结果更新。
3. 打开“词汇矩阵”，首屏显示单词卡与“第 N / 总数”。
4. 在 DevTools 阻断 `/api/vocab/review` 后刷新：有缓存时仍显示词卡和同步提示；清除 sessionStorage 后显示可重试错误态。

## Task 5: 刷新 FlashCard 的已更新到期队列

**Files:**
- Modify: `src/components/FlashCard.tsx:27-97`

- [ ] **Step 1: 首次读取当前政商务到期队列**

首次加载时请求政商务分区的第一页：

```ts
const page = await getReviewPage('business', 50, 0);
```

该组件当前没有分区选择 UI，因此保持既有政商务复习入口语义。

- [ ] **Step 2: 在提交一整批后重新读取更新后的队列**

每次 `submitReview` 都会将已复习词的 `next_review_date` 移到未来，因此最后一张卡提交成功后从 offset 0 读取更新后的队列：

```ts
const nextPage = await getReviewPage('business', 50, 0);
```

不得对已变更的到期队列使用累计 offset，否则会跳过尚未复习的词。当 `nextPage.items.length === 0` 时才结束本次会话。

- [ ] **Step 3: 回归验证两批复习**

准备至少 51 个 business 到期词后：

1. 打开闪卡，记录第一批前后两个 id。
2. 对第一批 50 个词分别提交任意质量分。
3. 记录第二批第一个 id。

预期：第二批第一个 id 不在第一批 id 集合内；当没有更多到期词时才显示完成状态。

## Task 6: 最终回归与部署前检查

**Files:**
- Modify: 无

- [ ] **Step 1: 执行 focused tests**

运行：

```powershell
npx tsx --test src/services/vocabAPI.test.ts src/services/vocabRequestDeduper.test.ts src/services/vocabLoadCoordinator.test.ts
npm run lint
npm run build
```

预期：全部成功。

- [ ] **Step 2: 执行生产数据库只读验证**

在服务器上执行：

```bash
sqlite3 /path/to/vocab.db "SELECT category, COUNT(*) FROM vocabulary GROUP BY category ORDER BY 2 DESC;"
curl -s "http://127.0.0.1:3001/api/vocab/list?light=1&category=business&limit=2&offset=0"
curl -s "http://127.0.0.1:3001/api/vocab/review?light=1&category=business&limit=2&offset=0"
```

预期：category 仅有 `business` / `general`；两个接口的 items 均属于 business，并返回分页对象。

- [ ] **Step 3: 完成功能验收记录**

| 菜单路径 | 测试数据 | 预期结果 | 对应需求 |
| --- | --- | --- | --- |
| 左侧栏 → 艾宾浩斯生词本 → 政商务 | 存量主题分类词 | 显示词条，不出现“空列表 + 加载更多” | 内容恢复 |
| 英语 → 词汇矩阵 | 5939 个到期词 | 单词学习卡与队列进度可见 | 紧凑展示 |
| 词汇矩阵 → 断网刷新 | 已存在 review 缓存 | 保留缓存卡并提示同步失败 | 失败不留白 |
| 词汇矩阵 → 断网刷新 | 清除 review 缓存 | 显示连接失败与重试，不显示“已清空” | 明确错误态 |
| 生词本 → 加载更多 | 至少 51 条 business 词 | 第二页继续显示同分区词条 | 分区分页 |
| 闪卡复习 | 至少 51 个 business 到期词 | 第二批与首批不重复 | review offset |

## 自检

- 设计中的历史归类、未来入库、分区分页、统计一致性、单卡队列和失败缓存均被任务覆盖。
- 计划不改 SM-2、造句、翻转、CSV 导出和手动收录语义。
- 所有请求参数、缓存 key 与函数签名在任务间使用同一名称。
