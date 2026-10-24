# SP-SCENE-01 破局(说) → 场景博弈会话入口设计

> **状态**：设计已批准；实现计划见 `docs/superpowers/plans/2026-08-16-sp-scene-01-speak-entry.md`；**尚未改产品代码**。  
> **日期**：2026-08-16  
> **关联**：`docs/superpowers/specs/2026-08-16-feedback-7.21-7.22-frozen-specs.md`（SP-SCENE-01）  
> **方案**：**A** — sessionStorage 深链 + `setActiveModule('gametheory')`；入口位置 **P1** 通栏

---

## 1. 目标与非目标

### 目标

- 破局(说)提供**一个**显著入口「进入场景博弈会话」。
- 点击后进入驭心博弈模块，并激活 Tab **「多人群体博弈会话」**。
- 1VS1 / 多人由用户在会话面板内自选；完整阶层/利益/心理侧写仍在**结束后**（现有 `GameTheorySessionPanel`），对局轻量提示保持现状。
- 保留说模块现有单次表达 + 审阅流程。

### 非目标

- 不在说页内嵌 `GameTheorySessionPanel` / 不重做会话引擎。
- 入口不预填角色数、不自动开局。
- 不改局势全景图 / `light_signals` 业务规则。

---

## 2. 架构

```
破局(说) P1 通栏按钮「进入场景博弈会话」
        ↓
sessionStorage['gt_focus_tab'] = 'session'
        ↓
setActiveModule('gametheory')  // MainContent → SpeakModule props
        ↓
dispatchEvent('navigate-gametheory-session')  // 已在模块内时仍能切 Tab
        ↓
GameTheoryModule 读 key → setActiveTab('session') → removeItem
        ↓
GameTheorySessionPanel（现有）
```

### 触碰文件

| 文件 | 改动 |
| --- | --- |
| `src/components/MainContent.tsx` | `<SpeakModule setActiveModule={setActiveModule} />` |
| `src/components/modules/SpeakModule.tsx` | props + P1 通栏入口 |
| `src/components/modules/GameTheoryModule.tsx` | 消费 `gt_focus_tab` + 监听 `navigate-gametheory-session`（仿 `gt_focus_history_id`） |

可选（plan 阶段再定是否需要）：`App.tsx` 监听事件仅作兜底；**最小实现以 props + GameTheory 监听为准**。

---

## 3. 数据流与 UI

### Storage

| Key | 合法值 | 生命周期 |
| --- | --- | --- |
| `gt_focus_tab` | `'session'` | 说页写入 → 博弈消费后立即删除 |

其它值：忽略。

### 按钮

- 主文案：`进入场景博弈会话`
- 副文案：`多轮 1VS1/多人博弈，结束后再出阶层与利益全景分析`
- 位置：**P1** — 说模块训练 Tab 行**上方**通栏（所有 Tab 可见）

### 点击序列

1. `sessionStorage.setItem('gt_focus_tab', 'session')`
2. `setActiveModule('gametheory')`（必有 props）
3. `window.dispatchEvent(new CustomEvent('navigate-gametheory-session'))`
4. `GameTheoryModule`：`applyFocusTabFromStorage()` → `setActiveTab('session')` → `removeItem`

---

## 4. 错误处理

| 情况 | 行为 |
| --- | --- |
| props 缺失 | 仍写 storage + dispatch；若无法切模块，开发态 `console.warn` |
| 模块挂起 | 走现有挂起页，不新增重试逻辑 |
| 已在 gametheory | 依赖自定义事件再次 `applyFocusTabFromStorage` |
| 非法 tab key | 忽略 |

---

## 5. 测试与验收

### 手工

1. 破局(说)见 P1 通栏入口  
2. 点击 → 驭心 +「多人群体博弈会话」Tab  
3. 面板可自选 2 人/多人  
4. 结束/全景仍可用（现引擎）  
5. 返回说模块，四 Tab 审阅仍可用  
6. 说页无内嵌完整会话面板  

### DoD

- P1 文案与跳转正确  
- 模块内再次点击仍能落到 session  
- 不改会话内核；不破坏现有审阅  

---

## 6. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-08-16 | 方案 A + P1；分段批准架构/数据流/错误处理/测试 |
