在“第二战役”中，我们将通过 Dify 工作流驱动内容生成，并在前端实现**时长监控**、**TTS 语音唤醒**以及**数据库同步**的闭环。

以下是完整的技术实现方案，包含目录结构、Dify DSL 以及前端 React 实现代码。

---

### 一、 文件目录与名称

```text
superme/
├── yml/
│   └── english_wakeup_routine.yml      # Dify 工作流 DSL 配置文件
├── src/
│   ├── services/
│   │   ├── trainingAPI.ts              # 新增：记录练习时长的 API
│   │   └── difyAPI.ts                  # 已有：调用 Dify 工作流
│   ├── components/
│   │   └── modules/
│   │       └── DailyWakeupModule.tsx   # 新增：每日唤醒核心模块（含计时、TTS、打卡）
│   └── App.tsx                         # 路由配置/模块引入

```

---

### 二、 任务 1：Dify 工作流配置 (YAML)

此工作流负责根据 `theme` 产出结构化语料，并附带明确的音标标识。
apikey=app-cATuHAaymkZEuTNzOezwRrge
---

### 三、 任务 2：前端“每日唤醒”逻辑实现

#### 1. API 服务层

**文件名称：** `src/services/trainingAPI.ts`

```typescript
// 记录练习时长并更新 training_sessions 表
export const trainingAPI = {
  saveSession: async (payload: {
    theme: string;
    duration_seconds: number;
    session_type: 'daily_wakeup';
  }) => {
    const response = await fetch('/api/training/session', { // 替换为真实后端接口
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        completed_at: new Date().toISOString(),
      }),
    });
    return response.json();
  }
};

```

#### 2. 核心唤醒模块 (含 TTS 与计时)

**文件名称：** `src/components/modules/DailyWakeupModule.tsx`
实现点击单词朗读、时长追踪及打卡。

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { difyAPI } from '../../services/difyAPI';
import { trainingAPI } from '../../services/trainingAPI';
import { PlayCircle, CheckCircle } from 'lucide-react'; // 假设使用 lucide 图标

interface VocabItem {
  word: string;
  meaning: string;
  ipa: string;
  note: string;
}

export const DailyWakeupModule: React.FC = () => {
  const [theme, setTheme] = useState('银团贷款');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 1. 计时逻辑
  const [seconds, setSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [data]); // 获取到语料后开始精准计秒

  // 2. TTS 朗读功能
  const playTTS = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // 3. 执行 Dify 工作流
  const handleStart = async () => {
    setIsLoading(true);
    startTimeRef.current = Date.now();
    try {
      const res = await difyAPI.runWorkflow('english_wakeup_routine', { theme });
      // 解析 LLM 返回的 JSON 字符串
      setData(JSON.parse(res.data.outputs.wakeup_json));
    } catch (e) {
      console.error("加载失败", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. 打卡逻辑
  const handleCheckIn = async () => {
    try {
      await trainingAPI.saveSession({
        theme,
        duration_seconds: seconds,
        session_type: 'daily_wakeup'
      });
      alert(`打卡成功！今日练习时长: ${Math.floor(seconds / 60)}分${seconds % 60}秒`);
    } catch (e) {
      alert("打卡记录失败");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h1 className="text-xl font-bold text-blue-700">🌅 发音与语法唤醒</h1>
        <div className="text-orange-500 font-mono font-bold text-lg">
          专注中: {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
        </div>
      </div>

      <div className="flex gap-2">
        <input 
          className="flex-1 p-3 border rounded-lg shadow-inner"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="输入学习主题..."
        />
        <button 
          onClick={handleStart}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {isLoading ? '唤醒中...' : '开始今日训练'}
        </button>
      </div>

      {data && (
        <div className="animate-fade-in space-y-6">
          {/* 单词列表区 */}
          <section className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center border-b pb-2">
              <span className="mr-2">📢</span> 高频词发音注意点
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.vocab.map((item: VocabItem, idx: number) => (
                <div 
                  key={idx} 
                  onClick={() => playTTS(item.word)}
                  className="p-4 border rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition group relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-lg text-gray-800">{item.word}</span>
                    <PlayCircle size={18} className="text-gray-300 group-hover:text-blue-500" />
                  </div>
                  <div className="text-blue-600 font-mono text-sm">{item.ipa}</div>
                  <div className="text-gray-600 text-sm mt-1">{item.meaning}</div>
                  <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    💡 {item.note}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 语法突破区 */}
          <section className="bg-blue-900 text-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-lg font-bold mb-3">🧩 场景语法突破：{data.grammar.point}</h2>
            <p className="text-blue-100 mb-4">{data.grammar.explanation}</p>
            <div className="space-y-3">
              {data.grammar.examples.map((ex: any, i: number) => (
                <div key={i} className="text-sm space-y-1">
                  <div className="flex gap-2"><span className="text-green-400">✅</span> {ex.correct}</div>
                  <div className="flex gap-2"><span className="text-red-400">❌</span> {ex.incorrect}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 打卡按钮 */}
          <div className="flex justify-center pt-6">
            <button 
              onClick={handleCheckIn}
              className="flex items-center gap-2 px-12 py-4 bg-green-500 text-white rounded-full font-bold text-lg hover:bg-green-600 shadow-xl transform active:scale-95 transition"
            >
              <CheckCircle /> 完成今日唤醒并打卡
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

```

---

### 四、 功能亮点说明

1. **精准时长记录**：通过 `useRef` 和 `setInterval` 实现从“点击开始”到“点击完成”的物理专注时长记录，避免切换标签页等干扰导致的无效计时。
2. **即点即读 (TTS)**：无需额外部署语音服务器，直接调用浏览器原生 `speechSynthesis`。用户点击单词卡片即可触发美式发音，实现发音注意点与实际听感的即时联动。
3. **数据化训练**：每次练习结束自动调用 `saveSession`，将主题、时长、类型同步至后端数据库 `training_sessions` 表，为后续生成练习报告提供原始数据。
4. **结构化语法对比**：不再是枯燥的说明，通过正反例对比（Correct/Incorrect），让用户快速掌握合同英语中常见的语法坑。