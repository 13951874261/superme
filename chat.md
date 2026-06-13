已完成对相关代码与后端接口的核对（`GameTheoryModule.tsx`、`difyAPI.ts`、`vocab-server/server.js`、`Cognitive Penetration Engine.yml`）。以下是 **选项 B：顶层认知升维训练（5 层 Why-Why-Why 纵深因果推演）** 的完整修改方案。

---

## 一、需求复述与确认

你确认要实现 **TAB 4「顶层认知升维」**，将其从“下一个阶段开发中…”占位符，改造为真实可用的高阶认知闭环：强制用户对一个管理事件连追五层因果（穿透表象 → 结构 → 历史 → 利益 → 终极规律），由 Dify 引擎逐层研判打分，达标后纸张翻页解锁成果，并落地 BRD 中“穿透历史/穿透结构/穿透因果（强制 5-10 层因果链推演）”的要求。

---

## 二、存在问题（现状诊断）

- 功能缺失：`GameTheoryModule.tsx` 中 `activeTab === 'ascension'` 仅为静态占位卡片，无任何交互逻辑与后端联动。
- 闭环断裂：BRD 要求的“5-10 层强制因果链推演 + 战略自省维度”完全未实现，与同模块已成熟的 TAB1/TAB2 形成体验断层。
- UI/UX 欠缺：缺少“层层递进的微投影纵深卡片 + 行政级水滴/翻页音效闭环 + 控制论强制解锁”机制，未达 `impeccable` / `design-taste-frontend` 规范要求的克制冷灰行政美学。

---

## 三、对应菜单路径

主控工作区顶栏 Tab 导航 → `驭心博弈` → 模块内子 Tab → `顶层认知升维`

（即 `MainContent.tsx` 的 `gametheory` → `GameTheoryModule.tsx` 内 `activeTab='ascension'`）

---

## 四、待修改文件目录与文件名称

- `src/components/modules/GameTheoryModule.tsx`（前端主改：新增升维状态 + 重构 ascension 面板 UI）
- `src/services/difyAPI.ts`（新增 `runCognitiveAscension` 接口与类型）
- `vocab-server/server.js`（新增 `/api/game-theory/ascension` 后端路由，对接 `Cognitive Penetration Engine.yml`）
- 复用既有资产（不重复造轮子）：`ModuleWrapper.tsx`、`Confetti.tsx`、`utils/soundEffects.ts`、`motion/react`、`canvas-confetti`

---

## 五、参考代码

### 1) `src/services/difyAPI.ts`（新增类型与函数）

```ts
export interface CognitiveAscensionInput {
  event_text: string;            // 待推演的管理事件
  layers: { level: number; why: string }[]; // 用户的 5 层 Why 推演
  dimension: 'history' | 'structure' | 'self'; // 穿透维度
}

export interface CognitiveAscensionResult {
  is_passed: boolean;            // 是否达标解锁
  depth_score: number;           // 纵深度评分 0-10
  layer_feedback: { level: number; verdict: string; gap: string }[]; // 逐层研判
  ultimate_law: string;          // AI 提炼的终极规律
  suggestion: string;            // 升维建议
}

export async function runCognitiveAscension(
  inputs: CognitiveAscensionInput,
  userId = 'default-user'
): Promise<CognitiveAscensionResult> {
  const res = await fetch('/api/game-theory/ascension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...inputs,
      user_current_profile: getUserCurrentProfile(),
      userId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '升维推演引擎请求失败，请检查后端');
  return data.result as CognitiveAscensionResult;
}
```

### 2) `vocab-server/server.js`（新增路由，复用现有 `/analyze` 模式）

```js
app.post('/api/game-theory/ascension', async (req, res) => {
  const { event_text, layers, dimension, user_current_profile, userId = 'default-user' } = req.body;
  if (!event_text || !Array.isArray(layers) || layers.length < 5) {
    return res.status(400).json({ success: false, error: '请完成至少 5 层因果推演后再提交' });
  }
  try {
    const difyApiKey = process.env.VITE_DIFY_COGNITIVE_KEY || process.env.VITE_DIFY_GAME_THEORY_KEY;
    const baseUrl = process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${difyApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: {
          event_text,
          layers_text: layers.map(l => `Why-${l.level}: ${l.why}`).join('\n'),
          dimension,
          user_current_profile: user_current_profile || ''
        },
        response_mode: 'blocking',
        user: userId,
      }),
    });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Dify 请求失败: ${response.status}` });
    }
    const data = await response.json();
    const raw = data?.data?.outputs?.result ?? data?.answer ?? '';
    const parsed = JSON.parse(String(raw).replace(/```json/g, '').replace(/```/g, '').trim());
    res.json({ success: true, result: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: '升维引擎异常: ' + err.message });
  }
});
```

### 3) `src/components/modules/GameTheoryModule.tsx`（替换 ascension 占位块）

```tsx
// 顶部新增 state
const [ascEvent, setAscEvent] = useState('');
const [ascLayers, setAscLayers] = useState<string[]>(['', '', '', '', '']);
const [ascDimension, setAscDimension] = useState<'history' | 'structure' | 'self'>('structure');
const [ascLoading, setAscLoading] = useState(false);
const [ascResult, setAscResult] = useState<CognitiveAscensionResult | null>(null);

const handleAscensionSubmit = async () => {
  if (!ascEvent.trim() || ascLayers.some(l => !l.trim())) { playGentleWarning(); return; }
  setAscLoading(true); setAscResult(null); playClick();
  try {
    const r = await runCognitiveAscension({
      event_text: ascEvent,
      layers: ascLayers.map((why, i) => ({ level: i + 1, why })),
      dimension: ascDimension,
    });
    setAscResult(r);
    if (r.is_passed) {
      playPageTurn();
      confetti({ particleCount: 50, spread: 45, origin: { y: 0.6 }, colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#fff'] });
    } else { playGentleWarning(); }
  } catch (e) { playGentleWarning(); }
  finally { setAscLoading(false); }
};
```

```tsx
{/* TAB 4: 顶层认知升维（替换原占位） */}
{activeTab === 'ascension' && (
  <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
    {/* 左 70%：5 层纵深因果链 */}
    <div className="lg:col-span-7 space-y-5">
      <textarea
        value={ascEvent} onChange={e => setAscEvent(e.target.value)}
        placeholder="录入一个待穿透的管理事件 / 高管博弈现象…"
        className="w-full h-24 bg-white border border-zinc-200/80 rounded-2xl p-4 text-sm text-zinc-800 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] focus:border-zinc-400 outline-none resize-none"
      />
      {ascLayers.map((val, i) => (
        <div key={i}
          className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] transition-all hover:shadow-md"
          style={{ marginLeft: `${i * 14}px` }}  /* 纵深层叠错位 */
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Why · 第 {i + 1} 层穿透</span>
          <input
            value={val}
            onChange={e => { const n = [...ascLayers]; n[i] = e.target.value; setAscLayers(n); }}
            placeholder={['表象之下的直接动因', '背后的结构性矛盾', '历史周期与路径依赖', '深层利益格局', '终极规律 / 不可逆趋势'][i]}
            className="w-full mt-2 bg-transparent border-b border-zinc-100 py-1.5 text-sm text-zinc-800 outline-none focus:border-zinc-400"
          />
        </div>
      ))}
      <button onClick={handleAscensionSubmit} disabled={ascLoading}
        className="w-full py-4 rounded-full text-xs tracking-widest uppercase font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
        {ascLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4 text-zinc-400" />}
        {ascLoading ? '纵深推演研判中…' : '提交五层因果链并启动升维研判'}
      </button>
    </div>

    {/* 右 30%：穿透维度 + 研判成果 */}
    <div className="lg:col-span-3 space-y-4">
      {/* 维度选择 + ascResult 逐层 verdict / ultimate_law 卡片渲染 */}
    </div>
  </div>
)}
```

---

## 六、执行计划（单步执行，每步提交确认）

1. 步骤 1：`difyAPI.ts` 新增 `CognitiveAscensionInput/Result` 类型与 `runCognitiveAscension` 函数 → 提交确认。
2. 步骤 2：`vocab-server/server.js` 新增 `/api/game-theory/ascension` 路由并对接 `Cognitive Penetration Engine.yml` → 提交确认。
3. 步骤 3：`GameTheoryModule.tsx` 新增升维 state + handler，替换 ascension 占位为 5 层纵深 UI（含音效、Confetti、维度选择、逐层研判卡片）→ 提交确认。
4. 步骤 4：运行 `npm run lint`（tsc 类型校验）验证编译通过 → 提交确认。
5. 步骤 5：交付功能测试用例并演示验证路径。

---

## 七、功能测试用例（预览，将在步骤 5 完整交付）

| 编号 | 菜单路径 | 测试数据 | 预期结果 | 对应需求 |
|---|---|---|---|---|
| TC-01 | 驭心博弈 → 顶层认知升维 | 事件 + 仅填 3 层 | 触发轻柔警告音，拦截提交并提示补全 5 层 | 强制 5 层闭环 |
| TC-02 | 同上 | 事件 + 5 层完整 + 维度“穿透结构” | 3 秒内返回研判，纸张翻页音 + 纸屑，展示逐层 verdict 与终极规律 | 5-10 层因果链推演 |
| TC-03 | 同上 | 达标 `is_passed=true` | 解锁成果卡片，落库个人画像 | 控制论闭环 |

---

确认信息：以上方案需新增 **1 个后端 API 路由**（`vocab-server/server.js`）与 **1 个 Dify Key 环境变量**（`VITE_DIFY_COGNITIVE_KEY`，未配置时回退复用 `VITE_DIFY_GAME_THEORY_KEY`）。这属于会影响后端服务的改动，请你确认是否同意。

