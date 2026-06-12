**第一步：需求复述与确认**

我理解您需要一份详细的实现方案，该方案将全面升级 UI/UX（实现声光电效果），并重构现有的“洞察（听）”模块以满足人性解码与破绽识别的业务需求。具体包括：
1.  增强音效系统。
2.  重构 `ListenModule.tsx`，实现三段式布局（左侧知识/素材、右侧训练、底部复盘）。
3.  添加具体的交互逻辑与视觉效果。

---

**第二步：详细实施计划**

如果您确认以下方案，我将按步骤执行修改。

### 1. 增强音效系统 (Sound & Light)
**修改文件**：`src/utils/soundEffects.ts`
**修改内容**：新增适合 UI 交互的轻量级音效。
- `playClick()`：按钮点击反馈（清脆的“嘀”声）。
- `playSwitch()`：场景切换反馈（平滑的过渡音效）。
- `playUpload()`：上传操作反馈（扫描感音效）。
- `playReveal()`：结果展示反馈（类似“叮”的魔法音效）。

### 2. 重构核心模块 UI (ListenModule)
**修改文件**：`src/components/modules/ListenModule.tsx`

#### (A) 布局与结构升级
采用 **左（知识/素材）- 右（训练）- 下（复盘）** 的垂直三段式布局。
- **左侧 (25%)**：
    - **Tab 切换**：“理论框架” vs “素材上传”
    - **理论框架**：折叠面板，按“概念-框架-知识点”展示逻辑学/心理学内容。
    - **素材上传**：URL 输入框 + PDF 文件上传按钮。
- **右侧 (75%)**：
    - **顶部场景栏**：通用社交、体制内职场、跨国企业（支持点击切换）。
    - **推送区**：展示 AI 生成的博弈案例（含非语言信号描述）。
    - **输入区**：文本输入框。
    - **反馈区**：AI 点评结果展示（支持折叠展开）。
- **底部**：每日复盘与得分展示区。

#### (B) 声光电交互实现
- **光 (Visual)**：为按钮、加载状态、结果展示添加 CSS 动画（如发光边框、脉冲动画）。
- **声 (Audio)**：在关键交互节点调用 `soundEffects.ts` 中的函数。

#### (C) 逻辑对接
- 保留并优化现有的 `fetchDynamicInsightScenario` 和 `fetchInsightFeedback` 调用逻辑。
- 新增本地状态 `leftPanelTab` (theory | upload) 和 `dailySummary` 用于复盘。

---

**第三步：参考代码片段**

以下是核心修改的参考代码结构：

**A. soundEffects.ts (新增函数)**
```typescript
// src/utils/soundEffects.ts
// ... existing functions ...

export function playClick() {
  // 轻量高频正弦波，短促点击声
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

export function playReveal() {
  // 类似魔法出现的上升音效
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}
```

**B. ListenModule.tsx (布局伪代码)**
```tsx
// src/components/modules/ListenModule.tsx
import { playClick, playSwitch, playReveal } from '../../utils/soundEffects';
// ... imports

export default function ListenModule() {
  // ... existing state (activeCategory, currentScenario, userInput, feedback)
  const [leftPanelTab, setLeftPanelTab] = useState<'theory' | 'upload'>('theory');
  const [isTheoryExpanded, setIsTheoryExpanded] = useState(false);
  const [dailyScore, setDailyScore] = useState(0); // 假设得分

  // ... existing logic (loadNewScenario, handleSubmit)

  const handleCategoryChange = (cat: CategoryType) => {
    playSwitch(); // 场景切换音效
    setActiveCategory(cat);
  };

  const handleSubmit = async () => {
    playClick(); // 点击提交按钮
    // ... submit logic
    if (feedback) playReveal(); // 结果出现
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 p-4">
      {/* 左侧：知识与素材区 (25%) */}
      <div className="w-1/4 bg-white rounded-2xl shadow-lg p-4 flex flex-col border border-gray-100">
        <div className="flex mb-4 border-b">
           <button onClick={() => setLeftPanelTab('theory')} className={`flex-1 pb-2 ${leftPanelTab==='theory'?'border-b-2 border-blue-500':''}`}>理论框架</button>
           <button onClick={() => setLeftPanelTab('upload')} className={`flex-1 pb-2 ${leftPanelTab==='upload'?'border-b-2 border-blue-500':''}`}>素材上传</button>
        </div>
        
        {leftPanelTab === 'theory' ? (
           <div className="flex-1 overflow-y-auto">
             {/* 理论框架折叠内容 */}
             <div className="p-3 bg-blue-50 rounded-lg mb-2">
                <div className="flex justify-between items-center" onClick={() => setIsTheoryExpanded(!isTheoryExpanded)}>
                   <span className="font-bold text-sm">逻辑学基础</span>
                   <span>{isTheoryExpanded ? '▲' : '▼'}</span>
                </div>
                {isTheoryExpanded && <div className="mt-2 text-xs text-gray-600">概念：三段论...框架：假言推理...</div>}
             </div>
           </div>
        ) : (
           <div className="flex-1 space-y-4">
             <input type="text" placeholder="输入网址或上传PDF" className="w-full p-2 border rounded text-sm" />
             <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700" onClick={playUpload}>上传素材</button>
           </div>
        )}
      </div>

      {/* 右侧：核心训练区 (75%) */}
      <div className="flex-1 flex flex-col gap-4">
         {/* 场景选择 */}
         <div className="flex gap-2 bg-gray-100 p-2 rounded-xl">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => handleCategoryChange(cat)} className={`px-4 py-1 rounded-lg text-sm font-bold ${activeCategory === cat ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{cat}</button>
            ))}
         </div>

         {/* 推送区 */}
         <div className="flex-1 bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-xl shadow-sm relative">
            <span className="text-xs text-indigo-500 font-bold uppercase">案例推送</span>
            <p className="mt-2 text-gray-800">{currentScenario || '点击获取新案例...'}</p>
         </div>

         {/* 输入区 */}
         <div className="h-32">
            <textarea className="w-full h-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" placeholder="输入你的判断..." value={userInput} onChange={e => setUserInput(e.target.value)} />
         </div>

         {/* 提交按钮 */}
         <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all">提交分析</button>

         {/* 反馈区 */}
         {feedback && (
           <div className="flex-1 bg-slate-900 text-white p-6 rounded-2xl shadow-2xl overflow-y-auto animate-fade-in">
              <ReactMarkdown>{feedback}</ReactMarkdown>
           </div>
         )}
      </div>
    </div>
  );
}
```

---

