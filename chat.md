Ah, excellent! The function `getUserCurrentProfile` in `vocabAPI.ts` has the exact same implementation.

Now, let's output the complete detailed redesign plan as requested by the user. I'll make sure it has the requested sections:
- UI/UX 方案 (UI/UX Scheme)
- 待修改文件目录 (File Directory to modify)
- 修改文件名 (File Names to modify)
- 具体的修改方案 (Concrete modification schemes)
- 参考代码 (Reference code)

Let's make sure it is in detailed Chinese, using no emojis (as per the "Zero Emoji" instruction), and with clean structure and formatting. I will output this now.好的，我将重新输出详细的改造方案，完全对齐您的核心需求并遵守各项约束规范（零 Emoji 政策、极简高端行政风）。

---

### **1. UI / UX 方案**

按照 **`impeccable`** 与 **`redesign-existing-projects`** 规范，用户画像的设置与展示将通过两处高阶、微细节的界面进行呈现和微操：

#### **A. 侧边栏对话舱头部指示器与下拉浮窗 (RightPanel Drawer)**
* **位置**：位于全局 AI 助手侧边栏顶部，紧邻“情报解密舱”标签，位于关闭按钮 `X` 左侧。
* **样式**：采用 **True Glassmorphism (真·玻璃拟态)** 质感。
  * **主按钮**：使用半透明背景 `bg-white/70 backdrop-blur-md`，搭配 1px 细微边界 `border border-gray-150`。文字使用小字号 `text-[10px] font-black uppercase tracking-wider`。左侧搭配一个 Lucide 极简地球图标 `Globe`，不带有任何表情符号或刺眼的霓虹渐变。
  * **下拉菜单**：当点击后，向下弹出圆角浮窗。浮窗背景使用 `bg-white/90 backdrop-blur-lg border border-gray-100 shadow-xl`。
  * **候选项反馈**：鼠标悬停在候选项（英国、美国、默认）上时，应用平滑的背景淡入 `hover:bg-slate-50` 效果；被选中的画像右侧显示一个微小的 Lucide 打勾图标 `Check`。

#### **B. 悬浮底右全局参数控制台 (GlobalSettingsPanel)**
* **位置**：点击右下角浮动控制按钮展开的面板。
* **样式**：采用与原版面板高度一致的深色科技质感。
  * 引入一个与“大模型对抗烈度”同等规格的三段式滑动选择排版（Segmented Control）。背景使用 `bg-gray-800 p-1 rounded-xl`，选中项使用 `bg-[#FF5722] text-white shadow-sm`，未选中项使用 `text-gray-400 hover:text-white`，提供极佳的反馈感与点击声效（`playScan()`）。

---

### **2. 待修改文件目录与文件名**

| 序号 | 待修改文件目录 | 修改文件名 | 修改性质 | 改造目的 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `src/utils` | `profileHelper.ts` | **新建** | 创建全局统一的画像状态同步和文本扫描拦截器。 |
| **2** | `src/services` | `difyAPI.ts` | **修改** | 去除重复定义，接入全局画像流，拦截流程的输入和输出。 |
| **3** | `src/services` | `listeningAPI.ts` | **修改** | 去除重复定义，接入全局画像流，拦截输入和输出。 |
| **4** | `src/services` | `trainingAPI.ts` | **修改** | 去除重复定义，接入全局画像流。 |
| **5** | `src/services` | `vocabAPI.ts` | **修改** | 去除重复定义，接入全局画像流。 |
| **6** | `src/components` | `GlobalSettingsPanel.tsx`| **修改** | 在底部悬浮面板中增加“地区画像”手动三段式调节。 |
| **7** | `src/components` | `RightPanel.tsx` | **修改** | 在侧边栏头部增加高级玻璃态画像下拉切换浮窗。 |

---

### **3. 具体的修改方案与参考代码**

#### **第一步：创建核心拦截与管理工具 (`src/utils/profileHelper.ts`)**
新建文件 `src/utils/profileHelper.ts`，为所有 API 请求和文本提炼打下基础：

```typescript
// D:\cursor\work\super-agent\src\utils\profileHelper.ts

/**
 * 获取当前持久化的画像
 */
export function getUserCurrentProfile(): string {
  try {
    const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
    if (!raw) return '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.join('; ');
      }
    }
    return raw;
  } catch (e) {
    return localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  }
}

/**
 * 保存画像并向全局广播状态同步事件
 */
export function saveUserCurrentProfile(profile: string) {
  localStorage.setItem('user_current_profile', profile);
  localStorage.setItem('User_Current_Profile', profile);
  window.dispatchEvent(new Event('global-profile-changed'));
}

/**
 * 智能分析提问或上下文，发现英国/美国画像指令时自动执行隐式更新
 */
export function updateProfileFromText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // 匹配英国 (UK) 信号
  if (
    lower.includes("切换为英国") || 
    lower.includes("切换为英音") || 
    lower.includes("英国(uk)") || 
    lower.includes("英国 (uk)") ||
    lower.includes("[profile: uk]") ||
    lower.includes("[profile: 英国]") ||
    (lower.includes("英国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "英国 (UK)") {
      saveUserCurrentProfile("英国 (UK)");
      return true;
    }
  }
  
  // 匹配美国 (US) 信号
  if (
    lower.includes("切换为美国") || 
    lower.includes("切换为美音") || 
    lower.includes("美国(us)") || 
    lower.includes("美国 (us)") ||
    lower.includes("[profile: us]") ||
    lower.includes("[profile: 美国]") ||
    (lower.includes("美国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "美国 (US)") {
      saveUserCurrentProfile("美国 (US)");
      return true;
    }
  }
  
  return false;
}

/**
 * 遍历并分析大模型返回的所有字符串，实现隐式自适应学习
 */
export function interceptOutputText(output: any): void {
  if (!output) return;
  if (typeof output === 'string') {
    updateProfileFromText(output);
  } else if (typeof output === 'object') {
    for (const key in output) {
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        const val = output[key];
        if (typeof val === 'string') {
          updateProfileFromText(val);
        } else if (val && typeof val === 'object') {
          interceptOutputText(val);
        }
      }
    }
  }
}

/**
 * 包装并注入当前画像到 Dify 请求体中
 */
export function injectUserProfile(inputs: Record<string, any> = {}): Record<string, any> {
  for (const key in inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, key) && typeof inputs[key] === 'string') {
      updateProfileFromText(inputs[key]);
    }
  }
  
  const profile = getUserCurrentProfile();
  return {
    ...inputs,
    user_current_profile: profile,
  };
}
```

#### **第二步：修改 `difyAPI.ts` 等四个 API 模块**
以 `src/services/difyAPI.ts` 为核心，进行如下清洗与桥接（其余三个 API 文件做类似修改）：

1. **导入辅助函数，剔除原有的重复 `getUserCurrentProfile()` 与 `injectUserProfile()` 定义**：
   ```typescript
   // 文件头部
   import { getUserCurrentProfile, injectUserProfile, interceptOutputText } from '../utils/profileHelper';
   ```
2. **在 API 核心 JSON 解析包装器中嵌入输出结果画像提炼拦截**：
   ```typescript
   function parseMaybeJson<T>(raw: unknown, fallbackMessage: string): T {
     if (typeof raw !== 'string') {
       interceptOutputText(raw);
       return raw as T;
     }

     interceptOutputText(raw);
     const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
     try {
       const parsed = JSON.parse(cleanJson) as T;
       interceptOutputText(parsed);
       return parsed;
     } catch {
       throw new Error(fallbackMessage);
     }
   }
   ```

#### **第三步：修改 `GlobalSettingsPanel.tsx` 页面**
将手动设置画像嵌入到右下角的浮动大模型面板中。

```typescript
// 引入依赖
import { getUserCurrentProfile, saveUserCurrentProfile } from '../utils/profileHelper';

// 组件内部添加状态与监听
const [profile, setProfile] = useState(() => getUserCurrentProfile());

useEffect(() => {
  const handleProfileChange = () => {
    setProfile(getUserCurrentProfile());
  };
  window.addEventListener('global-profile-changed', handleProfileChange);
  return () => window.removeEventListener('global-profile-changed', handleProfileChange);
}, []);
```
在组件返回的 TSX 中，插入画像三段式按钮：
```tsx
<div>
  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 block">
    地区画像偏好
  </label>
  <div className="flex bg-gray-800 p-1 rounded-xl">
    <button
      onClick={() => { saveUserCurrentProfile('英国 (UK)'); playScan(); }}
      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '英国 (UK)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
    >
      英国 (UK)
    </button>
    <button
      onClick={() => { saveUserCurrentProfile('美国 (US)'); playScan(); }}
      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${profile === '美国 (US)' ? 'bg-[#FF5722] text-white' : 'text-gray-400 hover:text-white'}`}
    >
      美国 (US)
    </button>
    <button
      onClick={() => { saveUserCurrentProfile(''); playScan(); }}
      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${!profile ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
    >
      默认
    </button>
  </div>
</div>
```

#### **第四步：修改 `RightPanel.tsx` 页面**
在侧边栏右上角关闭按钮左侧嵌入微透光玻璃下拉画像切换浮层。

```typescript
// 引入依赖
import { getUserCurrentProfile, saveUserCurrentProfile } from '../utils/profileHelper';
import { Globe, Check } from 'lucide-react';

// 组件内部增加状态与监听
const [profile, setProfile] = useState(() => getUserCurrentProfile());
const [showProfileMenu, setShowProfileMenu] = useState(false);

useEffect(() => {
  const handleProfileChange = () => {
    setProfile(getUserCurrentProfile());
  };
  window.addEventListener('global-profile-changed', handleProfileChange);
  return () => window.removeEventListener('global-profile-changed', handleProfileChange);
}, []);
```
在右上角的关闭按钮左侧插入 HTML 元素：
```tsx
<div className="relative mr-2 flex items-center">
  <button
    onClick={() => setShowProfileMenu(!showProfileMenu)}
    className="h-8 px-3 rounded-full border border-gray-150 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-650 cursor-pointer"
  >
    <Globe className="w-3.5 h-3.5 text-indigo-500" />
    <span>画像: {profile || '默认'}</span>
  </button>

  {showProfileMenu && (
    <div className="absolute right-0 top-full mt-2 z-[999] w-48 bg-white/90 backdrop-blur-lg border border-gray-100 rounded-2xl shadow-xl p-1.5 animate-[fadeIn_0.1s_ease-out]">
      {[
        { label: '英国 (UK)', value: '英国 (UK)', desc: '英式拼写及口音标准' },
        { label: '美国 (US)', value: '美国 (US)', desc: '美式拼写及口音标准' },
        { label: '未设定 (默认)', value: '', desc: '不进行特定倾向限制' }
      ].map((item) => (
        <button
          key={item.value}
          onClick={() => {
            saveUserCurrentProfile(item.value);
            setShowProfileMenu(false);
          }}
          className={`w-full flex flex-col items-start p-2 rounded-xl text-left transition hover:bg-slate-50 cursor-pointer ${
            profile === item.value ? 'bg-indigo-50/50' : ''
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              {item.label}
            </span>
            {profile === item.value && <Check className="w-3 h-3 text-indigo-600" />}
          </div>
          <span className="text-[8px] text-gray-400 font-medium mt-0.5">
            {item.desc}
          </span>
        </button>
      ))}
    </div>
  )}
</div>
```

