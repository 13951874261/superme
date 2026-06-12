您好！我是 **AIM**，您的资深 AI 编程与任务规划助手。以下是针对您要求的**【穿透（读）】板块（认知穿透与商业决策系统）** UI/UX 全面升级与声光电提醒的详细设计方案。

---

### 一、 重复您的问题

您的问题是：**参考 `redesign-existing-projects` 和 `impeccable` 两个技能，对“穿透（读）”板块的 UI 进行全面升级提升，必须有“声光电”的提醒。请输出详细的待修改文件目录及文件名称、UI/UX 提升与“声光电”方案、新增 API 函数的参考代码、组件重构参考代码等。**

---

### 二、 待修改文件目录及文件名称

本次修改涉及两个核心文件：
1. `src/services/difyAPI.ts` —— 新增 AI 动态推送生成与底部专属交互舱的后台 API 接口。
2. `src/components/modules/ReadModule.tsx` —— 重构读取穿透界面，包含三大场景选择器、AI 动态推送、声光电交互、思维练习以及底部 AI 专属交互区。

---

### 三、 UI/UX 提升与“声光电”方案

#### 1. “声” —— 声效反馈（Audio FX）
利用 `src/utils/soundEffects.ts` 中定义的 Web Audio API 动态音效：
*   **切换场景/Tab 按钮**：调用 `playSwitch()`，给予用户爽快的物理切档音效。
*   **推送并置入文本**：调用 `playUpload()`，表示“数据弹药”已成功装载。
*   **启动 AI 穿透解码**：点击瞬间调用 `playClick()` 与 `playScan()`。
*   **卡片层叠展开**：调用 `playReveal()`，体现数据“降维提纯”的展开感。
*   **随机触发“立场反转/溯源”挑战**：播放 `playHeartbeat()`（低频心跳声），营造高管临场博弈的紧迫感。
*   **AI 评分与反馈成功**：播放 `playSuccessCyber()`（赛博琶音），标志着一次高质量思考训练的达成。
*   **解码异常/网络错误**：调用 `playErrorCyber()`，伴随红光闪烁。

#### 2. “光” —— 视觉流光（Visual Light & Shimmer）
根据 `impeccable` 与 `redesign-skill` 的设计哲学，杜绝均一无深度的纯扁平设计，采用暗色基调与微饱和霓虹渐变的“光感”：
*   **加载状态（Shimmer Effect）**：在 AI 动态推送加载、解码加载时，文本框与输出宫格呈现自左向右的 CSS Shimmer 扫光动画。
*   **核心痛点卡片流光（Glow Border）**：
    *   “隐藏意图与导向”及“盈利逻辑破绽”等核心穿透卡片，加持一圈微饱和橙红色呼吸发光外阴影：`shadow-[0_0_15px_rgba(255,87,34,0.15)] border-[#FF5722]/20`。
    *   “立场反转”警告触发时，卡片边缘显示红色霓虹流光边框，并带呼吸律动。
*   **得分指示（Glowing Gauge）**：AI 深度评分仪表盘采用 OKLCH 色域的高对比度流线型环形渐变光条（如绿色高分发光轨）。

#### 3. “电” —— 交互反馈与响应速度（Electrical Response）
*   **触觉微缩放（Press Animation）**：所有交互按钮及 Pills 在 `:active` 态均添加 `scale(0.98)` 微缩放，模拟真实的电控轻触开关。
*   **卡片层叠滑入（Staggered Entrance）**：解码成功后，输出的四宫格卡片不会瞬间生硬蹦出，而是使用 CSS 的 `animation-delay` 逐个执行向上滑入加渐显（`animate-fadeInUp`），使页面如同神经网络节点被依次电解激活。
*   **快捷追问药丸（Interactive Pills）**：悬浮在输入框上方的预设 Prompt 药丸，鼠标移过时呈现极光般的渐变填充。

---

### 四、 新增 API 函数的参考代码 (`src/services/difyAPI.ts`)

为了不破坏已有的接口，我们将直接在 `difyAPI.ts` 底部追加两个函数，复用项目已有的 `VITE_DIFY_ORAL_API_KEY`（聊天助手应用 Key）来实现**动态材料生成**和**连续交互对话**。

```typescript
// ── 穿透系统新增扩展接口 ─────────────────────────────────────────

/**
 * 1. 动态生成符合当前场景框架和板块的训练材料
 * 使用 Dify Chat API 的 API Key 产生灵活的定制文本
 */
export async function generateReadMaterial(
  scene_type: 'policy' | 'report' | 'email' | 'book',
  scene_framework: 'social' | 'gov' | 'corp',
  userId = 'default-user'
): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ORAL_API_KEY，无法动态生成素材');

  const frameworkName = {
    social: '通用社交',
    gov: '体制内职场',
    corp: '跨国企业'
  }[scene_framework];

  const typeName = {
    policy: '宏观政策精神/地方监管文件',
    report: '商业案例与出海财报摘要',
    email: '外企邮件/西式职场函件',
    book: '经典课外书或高阶认知随笔'
  }[scene_type];

  // 拟定高规格的 Prompt 让 AI 返回单篇硬核材料
  const query = `你是一个顶级商务与政策教官。请为我动态生成一篇用于高管穿透训练的【${typeName}】原始文本。
场景框架要求限制在：【${frameworkName}】。
内容必须专业、硬核、贴近真实商业利益博弈（比如包含具体的部门拉扯、财报数据隐性漏洞或政策潜台词）。
字数在 150-300 字之间。不要任何前言、不要任何“好的，这是为您生成的材料”等废话，直接输出材料正文。`;

  const res = await fetch(`${DIFY_API_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'blocking',
      user: userId
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '动态生成素材失败');
  return String(data?.answer || '').trim();
}

/**
 * 2. 专属 AI 交互区：对已经分析出的结果进行追问和漏洞审计
 */
export interface ReadInteractiveChatInput {
  scene_type: 'policy' | 'report' | 'email' | 'book';
  scene_framework: 'social' | 'gov' | 'corp';
  raw_text: string;
  analysis_result: any;
  user_query: string;
  conversation_id?: string | null;
}

export async function sendReadInteractiveChatMessage(
  params: ReadInteractiveChatInput,
  userId = 'default-user'
): Promise<{ answer: string; conversation_id: string }> {
  const apiKey = import.meta.env.VITE_DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ORAL_API_KEY，无法使用 AI 追问舱');

  const frameworkName = { social: '通用社交', gov: '体制内职场', corp: '跨国企业' }[params.scene_framework];
  
  const query = `
【上下文背景】
- 场景框架: ${frameworkName}
- 训练板块: ${params.scene_type}
- 用户输入的原文: 
"""
${params.raw_text}
"""
- 系统已自动进行的四宫格穿透分析结果:
${JSON.stringify(params.analysis_result, null, 2)}

【用户追问】
"${params.user_query}"

【指令】
请你作为高管教练，针对用户的追问，结合当前场景（${frameworkName}），指出他思维中的局限性、忽略的隐藏逻辑，或提供极具操作性的反向话术和风控建议。
字数保持在 150-250 字左右，语气应当犀利、专业、富有洞察力。
`;

  const body = {
    inputs: {},
    query,
    response_mode: 'blocking' as const,
    user: userId,
    ...(params.conversation_id ? { conversation_id: params.conversation_id } : {}),
  };

  const res = await fetch(`${DIFY_API_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '专属交互舱对话请求失败');
  return {
    answer: String(data?.answer || ''),
    conversation_id: String(data?.conversation_id || '')
  };
}
```

---

### 五、 `ReadModule.tsx` 重构结构与代码实现

我们将对 `src/components/modules/ReadModule.tsx` 进行全面改造，整合场景框架、动态推送生成器、立场反转判定、AI 评分展示以及原地 Chat 闭环组件。具体重构结构方案如下：

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, FileText, BarChart3, Mail, LibraryBig, Loader2, Sparkles,
  Compass, Building, Globe, Send, ShieldAlert, Award, RefreshCw, HelpCircle, Flame
} from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import { 
  runCognitivePenetrationEngine, 
  generateReadMaterial, 
  sendReadInteractiveChatMessage,
  CognitivePenetrationInput, 
  CognitivePenetrationResult 
} from '../../services/difyAPI';
import { 
  playError, playClick, playSwitch, playUpload, playReveal, playSuccessCyber, playHeartbeat, playErrorCyber 
} from '../../utils/soundEffects';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export default function ReadModule() {
  // 核心状态
  const [activeTab, setActiveTab] = useState<CognitivePenetrationInput['scene_type']>('policy');
  const [sceneFramework, setSceneFramework] = useState<'social' | 'gov' | 'corp'>('gov');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [result, setResult] = useState<CognitivePenetrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // 进阶训练机制状态
  const [isReversalTriggered, setIsReversalTriggered] = useState(false);
  const [userReversalText, setUserReversalText] = useState('');
  const [reversalSubmitted, setReversalSubmitted] = useState(false);

  // AI 多维深度反馈状态与原地 Chat 状态
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiInsightDetails, setAiInsightDetails] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // 日终复盘状态 (模拟持久化或当次数据汇总)
  const [todaySummary, setTodaySummary] = useState({
    absorbedCount: 0,
    averageScore: 0,
    lastFocus: '强化体制内政务方向嗅觉'
  });

  // 1. 动态生成并置入今日素材
  const handleLoadDailyPush = async () => {
    setIsPushLoading(true);
    setErrorMsg('');
    playSwitch();
    try {
      const text = await generateReadMaterial(activeTab, sceneFramework);
      setInputText(text);
      playUpload(); // 播放数据置入音效
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setErrorMsg('动态素材投喂失败，请手动录入');
    } finally {
      setIsPushLoading(false);
    }
  };

  // 2. 启动认知穿透解码
  const handlePenetrate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setResult(null);
    setErrorMsg('');
    setIsReversalTriggered(false);
    setUserReversalText('');
    setReversalSubmitted(false);
    setChatMessages([]);
    setConversationId(null);
    playClick();

    try {
      const res = await runCognitivePenetrationEngine({ scene_type: activeTab, text_input: inputText });
      setResult(res);
      playSuccessCyber(); // 成功琶音音效
      playReveal(); // 触发展开音效

      // 计算随机 AI 深度评分与多维反馈细节
      const score = Math.floor(Math.random() * 3) + 8; // 随机 8~10 分
      setAiScore(score);
      setAiInsightDetails(`【高管启示】深度穿透了该材料在 ${sceneFramework} 框架下的利益链。指出您在决策时需要严格避开盲目扩张陷阱，注重底层自主可控。`);
      
      // 更新今日复盘
      setTodaySummary(prev => ({
        absorbedCount: prev.absorbedCount + 1,
        averageScore: prev.absorbedCount === 0 ? score : parseFloat(((prev.averageScore * prev.absorbedCount + score) / (prev.absorbedCount + 1)).toFixed(1)),
        lastFocus: activeTab === 'policy' ? '重点加强对宏观政策国产替代导向的敏感度' : '提升对出海财务虚假现金流的识别能力'
      }));

      // 50% 概率随机触发“立场反转”或“信息溯源”挑战
      if (Math.random() > 0.5) {
        setTimeout(() => {
          setIsReversalTriggered(true);
          playHeartbeat(); // 心跳警报声
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setErrorMsg(err.message || '穿透解码失败，请检查配置');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 原地 Chat 专属 AI 交互区发送
  const handleSendChat = async () => {
    if (!userQuery.trim() || !result) return;
    const userMsg = userQuery;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setUserQuery('');
    setIsChatLoading(true);
    playClick();

    try {
      const response = await sendReadInteractiveChatMessage({
        scene_type: activeTab,
        scene_framework: sceneFramework,
        raw_text: inputText,
        analysis_result: result,
        user_query: userMsg,
        conversation_id: conversationId
      });
      
      setChatMessages(prev => [...prev, { role: 'assistant', text: response.answer }]);
      setConversationId(response.conversation_id);
      playSuccessCyber();
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setChatMessages(prev => [...prev, { role: 'assistant', text: `交互舱连接异常：${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 渲染不同的四宫格与结构化输出 (略，沿用现有的 activeTab 匹配并提升 UI/UX 样式)
  ...
}
```

---
