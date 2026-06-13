
### **1. 存在问题**
*   **习惯追踪器（Habit Tracker）无法折叠与持久化**：侧边栏的 `Habit Matrix` 为纯静态渲染，无交互状态绑定，导致用户勾选后无法在 `localStorage` 中记录。同时，缺乏可折叠的展示交互，不满足 BRD 中“可折叠的 Habit Tracker”设计。
*   **缺失“职业发展跟踪表”**：当前左侧侧边栏组件中完全没有“职业发展跟踪表（历史职位至意向职位的进阶路径）”模块，使得高层管理者无法进行进阶路径的可视化追踪。
*   **动效与音效未深度对接**：折叠切换、状态勾选没有结合项目成熟的行政级水滴提示音（`playClick`）与翻页声（`playPageTurn`）。

---

### **2. 对应菜单路径**
*   **左侧导航与追踪区**（在“周主题归档链”下方，“即时答疑/多模型舱”上方）

---

### **3. 待修改文件目录**
*   `src/components`

---

### **4. 文件名称**
*   `Sidebar.tsx`

---

### **5. 参考代码**

在 `src/components/Sidebar.tsx` 中做如下改造：

#### **A. 引入音效与状态初始化部分**
```tsx
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { playClick, playPageTurn } from '../utils/soundEffects';

// 习惯折叠状态与 localStorage 持久化
const [isHabitOpen, setIsHabitOpen] = useState(true);
const [habits, setHabits] = useState(() => {
  const saved = localStorage.getItem('superme_habits');
  return saved ? JSON.parse(saved) : {
    sleep: false,
    diet: false,
    exercise: false,
    goodDeed: false
  };
});

// 处理习惯勾选更改并触发行政级水滴音效
const handleHabitChange = (key: string) => {
  const updated = { ...habits, [key]: !habits[key] };
  setHabits(updated);
  localStorage.setItem('superme_habits', JSON.stringify(updated));
  playClick(); // 行政级水滴音
};

// 职业轨道折叠状态与数据初始化
const [isCareerOpen, setIsCareerOpen] = useState(true);
const [careerPath, setCareerPath] = useState(() => {
  const saved = localStorage.getItem('superme_career');
  return saved ? JSON.parse(saved) : {
    history: '高级经理 (Senior Manager)',
    current: '总监 (Director)',
    target: '合伙人 (Partner / Managing Director)',
    progress: 65
  };
});
```

#### **B. 习惯追踪器与职业发展表 UI 渲染部分**
```tsx
{/* 习惯矩阵 (Habit Tracker) - 可折叠、可交互、带提示音 */}
<div className="mt-8 border-t border-gray-100 pt-6">
  <div 
    className="flex justify-between items-center cursor-pointer text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 hover:text-gray-700 transition-colors"
    onClick={() => { setIsHabitOpen(!isHabitOpen); playPageTurn(); }}
  >
    <span>Habit Matrix</span>
    {isHabitOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
  </div>
  
  {isHabitOpen && (
    <div className="grid grid-cols-2 gap-3 transition-all duration-300">
      {Object.entries({
        sleep: '睡眠达标',
        diet: '饮食克制',
        exercise: '核心运动',
        goodDeed: '日行一善'
      }).map(([key, label]) => (
        <label key={key} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-[#FF5722] hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all group">
          <input 
            type="checkbox" 
            checked={(habits as any)[key]}
            onChange={() => handleHabitChange(key)}
            className="w-4 h-4 text-[#FF5722] border-gray-300 rounded focus:ring-[#FF5722] cursor-pointer"
          />
          <span className="text-xs font-bold text-gray-600 group-hover:text-[#202124]">{label}</span>
        </label>
      ))}
    </div>
  )}
</div>

{/* 新增：职业发展跟踪表 (Career Progression) - 极简行政风格 */}
<div className="mt-6 border-t border-gray-100 pt-6">
  <div 
    className="flex justify-between items-center cursor-pointer text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 hover:text-gray-700 transition-colors"
    onClick={() => { setIsCareerOpen(!isCareerOpen); playPageTurn(); }}
  >
    <span>Career Progression</span>
    {isCareerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
  </div>
  
  {isCareerOpen && (
    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
      <div className="space-y-3">
        <div>
          <span className="text-[10px] text-gray-400 block">起点职位 (History)</span>
          <span className="text-xs font-bold text-gray-500">{careerPath.history}</span>
        </div>
        <div className="border-l-2 border-dashed border-gray-200 pl-3 my-1">
          <span className="text-[10px] text-emerald-600 font-semibold block">当前定位 (Current)</span>
          <span className="text-xs font-extrabold text-gray-800">{careerPath.current}</span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">意向目标 (Target)</span>
          <span className="text-xs font-bold text-[#FF5722]">{careerPath.target}</span>
        </div>
        
        {/* 进阶能力匹配进度条 */}
        <div className="mt-4 pt-2">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
            <span>能力匹配度</span>
            <span>{careerPath.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-[#FF5722] h-1.5 transition-all duration-500" style={{ width: `${careerPath.progress}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
```

---

### **6. 执行计划**

<proposed_plan>
### 侧边栏追踪区重构执行步骤 (Sidebar Tracking Area Refactoring Steps)

1. **导入资源与依赖 (Resource Importing)**
   * 在 `src/components/Sidebar.tsx` 文件中添加 `playClick` 与 `playPageTurn` 音效接口的引用。
   * 从 `lucide-react` 中引入 `ChevronUp` 及 `ChevronDown` 图标。

2. **状态绑定与本地序列化 (State & LocalStorage Binding)**
   * 编写 `useState` 以维护习惯面板和职业面板的独立折叠开关。
   * 编写基于 `localStorage` 的 `habits` state 加载及存储更新处理程序 `handleHabitChange`。

3. **DOM 与 UI 结构重构 (UI Refactoring)**
   * 替换原有的静态习惯跟踪 DOM 代码为条件渲染的 state 驱动代码。
   * 在其正下方追加新建的 `Career Progression` 行政风格面板模块。

4. **效果验证与确认 (Validation)**
   * 检查复选框点击是否流畅触发水滴声；折叠面板是否优雅收缩并伴有纸张翻页声。
   * 刷新界面确保状态在 `localStorage` 中被成功记住。
