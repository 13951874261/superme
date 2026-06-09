回滚成功——三个文件已完全恢复到修改前的状态。

---

## 📋 UI/UX 优化详细修改方案（仅方案，不执行）

### 需求复述

**核心任务**：分析项目功能，给出 UI/UX 方面最需完善的内容和具体实现方案，仅修改 UI/UX 不修改功能。

**项目概况**：基于 React + Tailwind CSS 的英语学习与翻译助手（Super Agent），包含艾宾浩斯记忆、盲听舱、口语演练、语法润色等模块。

---

### 实例确认（风格与粒度示例）

| 项目 | 内容 |
|------|------|
| **文件** | `src/components/CustomCardModal.tsx` 第 517 行 |
| **修改前** | `className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-gray-50 transition"` |
| **修改后** | `className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition duration-200"` |
| **说明** | 按钮图标在白卡片背景下，`text-gray-300`（约 2.6:1 对比度）→ `text-gray-500`（约 4.5:1），满足 WCAG AA 标准 |

---

### 步骤 1 —— 颜色对比度与可读性优化

| # | 文件 | 行号 | 当前代码片段（精确匹配） | 替换为 | 背景上下文 |
|---|------|------|--------------------------|--------|-----------|
| 1.1 | `src/components/CustomCardModal.tsx` | 517 | `text-gray-300 hover:text-red-500 rounded-lg hover:bg-gray-50 transition` | `text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition duration-200` | 白卡片内的图标按钮 |
| 1.2 | `src/components/modules/english/tabs/ListenTab.tsx` | 460 | `bg-white/10 text-gray-300 hover:text-white hover:bg-white/20` | `bg-white/10 text-gray-400 hover:text-white hover:bg-white/20` | 半透明浅色背景的 Segment Lock 按钮 |
| 1.3 | `src/components/modules/english/tabs/ListenTab.tsx` | 471 | `bg-white/10 rounded-lg text-[9px] ... text-gray-300 hover:text-white hover:bg-white/20` | `bg-white/10 rounded-lg text-[9px] ... text-gray-400 hover:text-white hover:bg-white/20` | 倍速按钮（同上背景） |
| 1.4 | `src/components/modules/english/tabs/ListenTab.tsx` | 718 | `text-[10px] text-gray-300` | `text-[10px] text-gray-500` | 单词释义文字（深色容器背景下） |
| 1.5 | `src/components/modules/english/tabs/VocabTab.tsx` | 187 | `ml-2 text-gray-300` | `ml-2 text-gray-500` | 白色卡片内的说明文字 |
| 1.6 | `src/components/modules/english/tabs/VocabTab.tsx` | 234 | `bg-white/5 text-gray-300 ... border-white/10` | `bg-white/5 text-gray-400 ... border-white/10` | 深色（`bg-[#202124]`）容器内的词条标签 |

**测试步骤**：
1. 浏览器打开对应页面，使用 Chrome DevTools → Rendering → 模拟 `prefers-contrast: more`
2. 用 [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 验证每个修改位对比度 ≥ 4.5:1（关键文本）或 ≥ 3:1（辅助文本）
3. 检查鼠标悬停（hover）颜色过渡自然，无闪烁

---

### 步骤 2 —— 响应式网格断点适配

| # | 文件 | 行号 | 精确替换：`查找` → `替换` |
|---|------|------|---------------------------|
| 2.1 | `src/components/CyberneticLockModal.tsx` | 51 | `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 md:grid-cols-2 gap-4"` |
| 2.2 | `src/components/DictionaryPanel.tsx` | 217 | `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 md:grid-cols-2 gap-4"` |
| 2.3 | `src/components/DictionaryPanel.tsx` | 433 | `"grid grid-cols-2 gap-4"` → `"grid grid-cols-1 md:grid-cols-2 gap-4"` |

**测试步骤**：
1. Chrome DevTools → 切换设备工具栏，分别以 iPhone SE (375px)、iPad (768px)、Desktop (1280px+) 查看
2. 验证小屏下自动变为单列，无水平滚动条
3. 确认交互元素触控目标 ≥ 44px

---

### 步骤 3 —— SVG 布局固宽防断裂优化

| # | 文件 | 行号 | 精确替换：`查找` → `替换` |
|---|------|------|---------------------------|
| 3.1 | `src/components/EbbinghausChart.tsx` | 130 | `"w-full min-w-[440px] h-auto overflow-visible"` → `"w-full max-w-full md:min-w-[440px] h-auto overflow-visible"` |

**备选方案**（如极窄屏仍需查看完整图表）：
- 保持 `min-w-[440px]`，在外层容器加 `overflow-x-auto` 并在小屏显示横向滚动提示

**测试步骤**：
1. 将浏览器宽度缩小至 320px，验证无水平溢出或出现可控滚动
2. 若改用 `overflow-x-auto`，确认滚动提示可见

---

### 步骤 4 —— 图像无障碍标识补充

| # | 文件 | 行号 | 精确操作 |
|---|------|------|----------|
| 4.1 | `src/components/MemoryAidPanel.tsx` | 126 | 在 `<img` 标签内添加 `alt="记忆助手插图"`（或根据 `imageUrl` 动态传值） |

**扩展搜索**（建议在实施时执行）：
```bash
rg '<img' --include='*.tsx' -l   # 列出所有含 img 的文件
rg 'alt=' --include='*.tsx'       # 检查已存在的 alt
```

**测试步骤**：
1. Chrome DevTools → Lighthouse → Accessibility 审计，确认无 "Images do not have alternate text" 告警
2. 使用屏幕阅读器（如 NVDA）导航验证 alt 文本可读

---

### 步骤 5 —— 异步按钮加载防护

| # | 文件 | 行号 | 当前状态 | 实施方案 |
|---|------|------|----------|----------|
| 5.1 | `src/components/modules/english/tabs/DashboardTab.tsx` | 573 | `onClick={async () => { ... }}` 无 disabled/loading | ① 引入 `const [loading, setLoading] = useState(false)` ② 在 async 内 `setLoading(true)` / `finally { setLoading(false) }` ③ `className` 动态加 `loading ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''` ④ 按钮文字 `loading ? <Loader2 className="animate-spin" /> : '提交'` |
| 5.2 | `src/components/modules/english/tabs/DashboardTab.tsx` | 1304 | 同上 | 同上模式 |
| 5.3 | `src/components/modules/english/tabs/ListenTab.tsx` | 264 | 同上 | 同上模式 |

**重要约束**：仅修改 UI 状态层（loading state + className），不改变 `try/catch` 内的业务逻辑和 API 调用参数。

**测试步骤**：
1. 打开页面，点击异步按钮，确认按钮变灰、不可点击且显示加载动画
2. 快速连续点击 3 次，确认只发起一次请求
3. 接口完成后按钮恢复正常状态

---

### 回滚方案

每个步骤修改前创建独立 commit，若问题出现，使用：
```bash
git revert <commit-hash>
```

---

### 分支命名与 PR 建议

| 步骤 | 分支名 | PR 标题示例 |
|------|--------|-------------|
| 1 | `codex/uiux/contrast-fixes` | `ui: improve text contrast in 3 components` |
| 2 | `codex/uiux/responsive-grids` | `ui: add mobile-first responsive breakpoints` |
| 3 | `codex/uiux/chart-overflow` | `ui: fix Ebbinghaus chart overflow on mobile` |
| 4 | `codex/uiux/accessibility-alt` | `ui: add missing alt attributes for accessibility` |
| 5 | `codex/uiux/loading-states` | `ui: add loading protection to async buttons` |

---
