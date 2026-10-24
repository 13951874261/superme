# B·AI 高管数字沙盘 — 极雅化 UI/UX 提升方案

> **诊断日期：** 2026-06-22  
> **方案版本：** v1.0  
> **设计基准：** 极雅主义（Minimal Elegance）+ 物理按压反馈 + Bento 2.0 网格节奏  
> **核心色彩：** OKLCH（品牌深橙 #FF5722 = oklch(65% 0.22 50)）  
> **技术栈：** React 19 + Tailwind CSS v4 + Motion (Framer Motion) + Phosphor Icons

---

## 一、总体设计评估

### 1.1 当前项目优势

| 维度 | 评估 |
|------|------|
| 品牌一致性 | 品牌深橙 #FF5722 作为唯一强调色，使用面积合理 |
| 排版系统 | 已建立 8pt 网格间距体系、Outfit 字体、OKLCH 色彩 token |
| 动效基础 | 已使用 spring 弹簧物理（GLOBAL_SPRING）、skeleton 骨架屏、stagger 动画 |
| 组件复用 | ModuleWrapper 统一包装，sub-tab 有统一的 active 样式 |
| 无障碍 | 有键盘导航、aria 标签、focus ring |

### 1.2 当前项目存在的问题（诊断报告）

经过对 8 个核心组件的逐文件审查，发现当前系统仍有残留的 "AI-Slop" 痕迹、排版混乱、色彩噪声以及缺乏细腻物理反馈的问题：

**问题 A：Eyebrow 与全大写滥用导致的排版杂噪 (Typography Slop)**

项目大量使用大字距、全大写的 `uppercase tracking-widest`（如 Header 中的 "EVOLUTION TRACKER"、Sidebar 中的 "Monthly Calendar"、"Habit Matrix"）。违反了 `impeccable` 中 3 section 中最多 1 个 eyebrow 的规则。全大写使界面显得吵闹，剥夺了真正的商务聚焦感。

**问题 B：硬编码灰色带来的色彩噪声 (Color Ink Desaturation)**

代码里混杂存在着 `text-gray-400`、`text-slate-550`、`text-zinc-900` 等硬编码灰色。`index.css` 定义了优美的 OKLCH 语义灰度（`--color-ink-primary`, `--color-ink-secondary`, `--color-ink-muted`），但各组件中没有真正引用它们，导致冷灰（slate）与暖灰（gray/zinc）混合，卡片背景视觉显得"脏"。

**问题 C：嵌套卡片边框造成的层级膨胀 (Card Soup)**

`ModuleWrapper.tsx` 带有过重的底色卡片、1px 纯实线边框以及模糊度过高的径向渐变背景。当 `DashboardTab.tsx` 被放置到 wrapper 里时，再次使用了独立的 `bento-card` 或自制阴影，Card within a card 的嵌套造成 Z-index 语义错乱。

**问题 D：缺少物理触感按压与非弹性过渡 (Static & Hard Interaction)**

主导航 Tab 点击状态以及习惯打卡按钮的 active 反馈仅用 `scale-105` 缩放，缺少物理阻尼触感。下拉菜单的展开动画使用的是简易的 CSS 淡入（`animate-[fadeIn_0.15s_ease-out]`），快速切换时由于没有 `AnimatePresence` 做 exit 动画而出现闪烁。

### 1.3 问题严重程度总结

| 问题类别 | 严重程度 | 受影响文件数 |
|---------|---------|-------------|
| Eyebrow 与全大写滥用 | 🔴 高 | 4 个文件 |
| 硬编码灰色色彩噪声 | 🔴 高 | 所有组件文件 |
| 嵌套卡片层级膨胀 | 🟡 中 | 3 个文件 |
| 静态硬变缺少物理触感 | 🟡 中 | 3 个文件 |

---

## 二、待修改文件清单 (Scope of Work)

| 文件路径 | 修改内容 | 改进目标 |
|---|---|---|
| `src/index.css` | 追加 `.liquid-glass` 玻璃微质感与极雅卡片规范 | 统一全局样式微质感 |
| `src/components/modules/ModuleWrapper.tsx` | 重构标题区为纯排版驱动，精简装饰背景 | 去除冗余卡片，让主要模块标题落地 |
| `src/components/MainContent.tsx` | 净化主 Tab 排版细节，替换锁定 Icon 提示 | 清理全大写噪声，统一 Tab 视觉比例 |
| `src/components/Header.tsx` | 重构声线控制中心弹出层动效，统一为 Spring 物理动画 | 消除过渡硬变与菜单定位闪烁 |
| `src/components/Sidebar.tsx` | 精简习惯打卡、日历单元格、职业路径追踪器样式 | 去除多余背景及边框，提高视觉空气感 |
| `src/components/RightPanel.tsx` | 升级 `AnimatePresence` + `GLOBAL_SPRING` 侧滑手感 | 实现顶级跟手感，规避 iframe 闪动 |

---

## 三、专项提升方案与参考代码

### 3.1 CSS 净化与双 Bezel 微质感规范 (src/index.css)

在全局 CSS 中追加两项高级 UI 专用的质感修饰：

```css
/* src/index.css 中追加以下样式定义 */

/* 极雅双框线 Bezel 卡片体系 */
.haptic-card {
  background: var(--color-surface);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 1.5rem;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 4px 20px -4px rgba(9, 9, 11, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.01);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.haptic-card:hover {
  transform: translateY(-1px);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 10px 30px -10px rgba(9, 9, 11, 0.06),
    0 16px 40px rgba(0, 0, 0, 0.02);
}

/* 玻璃拟态 web 逼近方案：用于悬浮组件 */
.liquid-glass-approx {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(190%);
  -webkit-backdrop-filter: blur(20px) saturate(190%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 10px 30px -10px rgba(0, 0, 0, 0.04);
}
```

### 3.2 模块包装器纯排版驱动化 (ModuleWrapper.tsx)

去除不必要的白色卡片底色及大面积径向模糊底纹，让每个大章节的标题呈气泡散落状，大幅增加呼吸感。

**修改文件：** `src/components/modules/ModuleWrapper.tsx`

```tsx
import React from 'react';

interface ModuleWrapperProps {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  description?: string;
  badge?: React.ReactNode;
  compact?: boolean;
}

export default function ModuleWrapper({
  id,
  title,
  icon,
  children,
  isOpen = true,
  description,
  badge,
  compact = true
}: ModuleWrapperProps) {
  const [main, sub] = title.split('｜').map(s => s.trim());

  return (
    <section id={id} className={`w-full flex flex-col ${compact ? 'mb-8' : 'mb-14'}`}>
      {/* 标题包装：去边框，去阴影，改用纯粹的高级排版排布 */}
      <div className="flex flex-col gap-2 mb-6 px-1">
        <div className="flex items-center gap-3">
          {/* 统一图标容器：浅色微妙底 + 小圆角 + 品牌色 */}
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-subtle)] flex items-center justify-center text-[var(--color-brand)]">
            {icon}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display text-2xl font-black text-[var(--color-ink-primary)] tracking-tight">
              {main}
            </h2>
            {badge}
          </div>
        </div>

        {sub && (
          <span className="text-xs font-bold tracking-wide uppercase text-[var(--color-brand)]">
            {sub}
          </span>
        )}

        {description && (
          <div className="mt-1 max-w-[70ch]">
            <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
              {description}
            </p>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="w-full">
          {children}
        </div>
      )}
    </section>
  );
}
```

### 3.3 导航 Tab 降噪 (MainContent.tsx)

去掉 `uppercase tracking-widest`，降低视觉厚度，引入物理按压反馈。

**修改文件：** `src/components/MainContent.tsx` (约第 98-124 行)

```tsx
{TABS.map(tab => {
  const isTabLocked = isLocked && tab.id !== 'english';
  const isActive = activeModule === tab.id;
  return (
    <button
      key={tab.id}
      onClick={() => handleTabClick(tab.id as ModuleType)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 relative select-none cursor-pointer active:scale-95 active:translate-y-[1px] ${
        isActive
          ? 'bg-white text-[var(--color-ink-primary)] border-b-2 border-[var(--color-brand)] shadow-sm'
          : isTabLocked
          ? 'text-[var(--color-ink-muted)] opacity-60 cursor-not-allowed'
          : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-white/40'
      }`}
    >
      {isTabLocked ? <Lock className="w-3.5 h-3.5" /> : tab.icon}
      <span>{tab.label}</span>
    </button>
  );
})}
```

### 3.4 顶部控制中心动效升级 (Header.tsx)

重写声线发音面板的展开/隐藏动画，将原有的 CSS 动画替换为基于 `motion/react` 的受控 Spring 渲染。

**修改文件：** `src/components/Header.tsx` (约第 90-173 行)

```tsx
import { motion, AnimatePresence } from 'motion/react';

// 替换原有的 && 控制写法
<AnimatePresence>
  {showVoiceDropdown && (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="absolute right-0 top-full mt-3 z-50 w-80 bg-white/90 backdrop-blur-2xl border border-[var(--color-border)] rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)] overflow-hidden text-left"
    >
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/40">
        <span className="text-[11px] font-black text-[var(--color-ink-primary)] tracking-wide">声线控制中心</span>
        <button onClick={() => setShowVoiceDropdown(false)} className="text-xs text-zinc-400 hover:text-zinc-600">关闭</button>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
        {VOICE_OPTIONS.map((voice) => {
          const isSelected = voice.id === selectedVoice;
          return (
            <div
              key={voice.id}
              onClick={() => handleSelectVoice(voice.id)}
              className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                isSelected ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)]' : 'hover:bg-zinc-50'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold">{voice.name}</span>
                <span className="text-[9px] text-[var(--color-ink-muted)]">{voice.country}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### 3.5 黄金折叠舱物理滑动跟手化 (RightPanel.tsx)

RightPanel 是系统分析的枢纽，利用 Framer Motion 实现丝滑的弹性收缩过渡，避免突兀的 CSS 布局变化。

**修改文件：** `src/components/RightPanel.tsx` (约第 125-140 行)

```tsx
import { motion, AnimatePresence } from 'motion/react';
import { GLOBAL_SPRING } from '../utils/motion';

return (
  <AnimatePresence>
    {isOpen && (
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={GLOBAL_SPRING} // 物理弹簧阻尼：stiffness: 100, damping: 20
        className="fixed right-0 top-0 h-screen w-[30vw] min-w-[360px] border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[-20px_0_50px_rgba(0,0,0,0.03)] z-[99] flex flex-col overflow-hidden"
      >
        {/* 标题控制栏 */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${activeTab === 'assistant' ? 'bg-[var(--color-ink-primary)] text-white' : 'text-[var(--color-ink-secondary)]'}`}
            >
              AI 助手
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${activeTab === 'context' ? 'bg-[var(--color-ink-primary)] text-white' : 'text-[var(--color-ink-secondary)]'}`}
            >
              情报舱
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-zinc-400 hover:text-[var(--color-brand)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'assistant' ? (
            <iframe src="..." className="w-full h-full border-none" allow="microphone" />
          ) : (
            <div className="p-5 space-y-6">
              {/* 精美解密排版 */}
            </div>
          )}
        </div>
      </motion.aside>
    )}
  </AnimatePresence>
);
```

---

## 四、UI/UX 改进验证用例表 (Test Plan)

完成修改后，按以下测试用例进行交互走查，验证极雅化达成效果：

| 模块名称 | 测试路径与操作步骤 | 测试数据 | 预期结果 |
|---|---|---|---|
| 排版节奏与 Tab | 1. 启动项目，进入 EnglishModule.tsx<br>2. 观察顶层导航 Tab 及二级 Sub-tabs 的字体字距大小 | 正常语言模式 | 标签可读性良好，大写 Eyebrow 数量显著减少（整页不超过 2 处），Tab 切换平滑无抖动 |
| 发音面板 Spring 动效 | 1. 连续快速点击 Header 声线选择按钮触发展开/关闭<br>2. 观察下拉层动画 | 声线选择 | 面板流畅弹出与收起，无硬变和布局卡顿，试听列表无杂乱的 1px 全包卡片边框 |
| 黄金折叠过渡 | 1. 在主界面双击选中任意英文单词拦截释义<br>2. 观察右侧面板弹出行为及左侧 MainContent 的宽度变化 | `negotiation` 等商务词汇 | 右侧面板在弹簧物理阻尼驱动下侧滑展开，MainContent 平滑横向缩进 |
| 打卡矩阵与打卡交互 | 1. 尝试在 Sidebar.tsx 连续勾选多个习惯习惯打卡矩阵<br>2. 长按打卡按钮 | 习惯勾选状态 | 打卡卡片呈现轻量渐变或纯白 haptic 卡片底色；点击时带有明显的 `active:scale-95` 物理触感下沉 |

---

## 五、执行优先级与建议顺序

1. **Phase 1（CSS 基础设施）**：`src/index.css` — 先追加新样式，不破坏现有样式。
2. **Phase 2（组件改造）**：`ModuleWrapper.tsx` — 作为其他模块的父容器，优先改造。
3. **Phase 3（动效升级）**：`Header.tsx` + `RightPanel.tsx` — Spring 动效与 AnimatePresence 替换。
4. **Phase 4（全局净化）**：`MainContent.tsx` + `Sidebar.tsx` — 全大写清理与色彩 token 替换。
5. **Phase 5（回归验证）**：执行上述 Test Plan 中的所有用例。

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
