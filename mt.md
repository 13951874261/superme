本次改造将彻底打破之前单一、硬编码的界面，为**纵深书面起草 (`WriteModule.tsx`)** 注入强大的跨文化辅助指导阵列，并为**多角色口语战争室 (`OralWarRoom.tsx`)** 注入 5 大顶级高压商业场景的动态切换引擎。

以下是完整的改造与升级方案。

---

### 一、 改造文档结构与总体架构

本次战役主要涉及前端界面的重构，使其能够完美接住新的 Dify 引擎能力。

```text
superme/
├── dify-workflows/
│   └── English_Oral_Sandbox.yml         <-- [更新] 您提供的最新带 5 大场景的 DSL (已完成)
└── src/
    └── components/
        └── modules/
            ├── WriteModule.tsx          <-- [重构] 新增左侧跨文化静态指导抽屉 (Grid 拆分)
            └── OralWarRoom.tsx          <-- [重构] 植入 5 大场景数据字典、下拉切换开关及解析新 JSON 字段

```

---

### 二、 核心代码改造：纵深书面起草面板补全 (`WriteModule.tsx`)

我们将原本单列的书面起草区拆分为左右布局（`grid-cols-12`），左侧建立一个“跨文化合规辅导侧边栏”，供高管在起草时进行“作弊级”的对照参考。

请替换 `src/components/modules/WriteModule.tsx`：

```tsx
import React, { useState } from 'react';
import { PenTool, ChevronDown, BookOpen, AlertTriangle, ShieldCheck } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

// 静态跨文化指导库数据
const GUIDANCE_LIBRARY = [
  {
    id: 'compliance',
    title: '《外企跨国合规函件指南》',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    content: '1. 责任隔离：使用被动语态描述客观问题 (e.g., "It has been observed that..." 而非 "We made a mistake")。\n2. 方案前置：外企高层不看过程，起首第一段必须包含 Bottom Line (底线数据) 和 Solution (解决方案)。\n3. 抄送礼仪：CC 列表中层级最高者决定了行文的最高涉密级别，慎用 BCC。'
  },
  {
    id: 'minefields',
    title: '《欧美非三地沟通雷区》',
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    content: '【美企】极度结果导向，忌讳冗长的中式寒暄，直接切入核心商业价值。\n【欧企(英/德/法)】注重程序正义与 ESG，委婉但极度较真，忌讳侵略性施压，多用 "Would it be possible..."\n【中东/非洲】关系先于业务。必须先建立私人层面的 Respect (尊重)，忌讳在邮件中直接用法律条款施压。'
  }
];

export default function WriteModule() {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(3);
  const [openGuide, setOpenGuide] = useState<string | null>('compliance');

  return (
    <ModuleWrapper 
      title="立言 ｜ 高维决策文治" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="左翼引入跨文化红线指南，右翼进行三级纵深批阅，彻底隔离政治与合规风险。"
    >
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* 左翼：静态跨文化指导抽屉面板 */}
        <aside className="xl:col-span-4 flex flex-col gap-4">
          <div className="bg-[#202124] text-white rounded-[2rem] p-6 shadow-lg">
            <h4 className="text-xs font-black tracking-widest uppercase flex items-center mb-6 text-[#FF5722]">
              <BookOpen className="w-4 h-4 mr-2" />
              Cross-Cultural Guidance
            </h4>
            <div className="space-y-4">
              {GUIDANCE_LIBRARY.map((guide) => (
                <div key={guide.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all">
                  <button 
                    onClick={() => setOpenGuide(openGuide === guide.id ? null : guide.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2">
                      {guide.icon} {guide.title}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openGuide === guide.id ? 'rotate-180 text-white' : ''}`} />
                  </button>
                  {openGuide === guide.id && (
                    <div className="p-4 pt-0 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-medium border-t border-white/5 mt-2">
                      {guide.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 右翼：核心草稿与批阅区 (原有代码架构调整) */}
        <section className="xl:col-span-8 bg-white rounded-[2.5rem] p-8 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <label className="text-xs font-black text-gray-400 tracking-widest uppercase">战略行文起草台</label>
            <select className="text-xs border border-gray-200 bg-[#f8f9fa] rounded-full px-4 py-2 outline-none focus:border-[#FF5722] text-[#202124] font-bold cursor-pointer">
              <option>跨国合规/法务信函</option>
              <option>外企高管越级汇报</option>
              <option>危机公关对外声明</option>
            </select>
          </div>
          
          <textarea 
            rows={8} 
            className="w-full bg-[#f8f9fa] rounded-3xl p-6 text-sm outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-400 font-medium focus:bg-white focus:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all mb-6 border border-transparent focus:border-[#FF5722]/30" 
            placeholder="结合左侧跨文化指南，起草您的英文决策指令..."
          ></textarea>
          
          <button className="w-full btn-primary text-sm py-4 rounded-full tracking-widest uppercase font-black hover:-translate-y-1 transition-transform mb-8 shadow-lg">
            开启三层阶梯纵深批阅
          </button>

          {/* ... 此处保留原有的 L1, L2, L3 极简无框风琴展板代码 ... */}
          {/* (为节省篇幅省略原有未更改的风琴展板代码，直接复用您项目中的现有代码即可) */}
        </section>

      </div>
    </ModuleWrapper>
  );
}

```

---

### 三、 核心代码改造：口语战争室动态场景引擎 (`OralWarRoom.tsx`)

我们需要建立 5 大场景的本地数据字典，在用户切换场景时，动态渲染左侧的角色和冲突点，并在发送给 Dify 时**强制注入场景切换指令**。

请替换 `src/components/modules/OralWarRoom.tsx`，加入场景引擎：

```tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Mic, Send, ShieldAlert, Sparkles, Target, Users, Clock, Globe } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { sendOralChatMessage } from '../../services/difyAPI';

// === 新增：5 大高压场景字典 ===
const SCENE_DATABASE = [
  {
    id: 'scene-1',
    title: '场景一：国际银团贷款谈判',
    desc: '核心争议：利率上浮 0.5% 与抵押物权属争议。借款方资金缺口倒逼 72 小时谈判时限。',
    allies: [{ name: 'CEO', label: '盟友', desc: '极力推动落地，愿让步换时间' }],
    blockers: [{ name: 'CFO', label: '阻力', desc: '严控 IRR 红线，要求重跑估值' }],
    neutrals: [{ name: '监管方', label: '中立', desc: '只关注合规证据与权属文件' }],
    conflicts: ['利率上浮 0.5%', '抵押物权属']
  },
  {
    id: 'scene-2',
    title: '场景二：危机公关媒体发布会',
    desc: '核心争议：亚太子公司环保数据造假，监管介入，各方博弈信息披露边界。',
    allies: [{ name: '公关总监', label: '盟友', desc: '试图用技术性误差推锅给第三方' }],
    blockers: [{ name: '法务官', label: '阻力', desc: '警告承认将触发天价罚款' }],
    neutrals: [{ name: '财经记者', label: '对立', desc: '掌握邮件截图，紧逼决策链' }],
    conflicts: ['数据造假责任', '披露边界']
  },
  {
    id: 'scene-3',
    title: '场景三：中东商务晚宴谈判',
    desc: '核心争议：主权基金新能源开发，核心条款在礼仪博弈中暗中交锋。',
    allies: [{ name: '投资总监', label: '盟友', desc: '用家族荣誉包装强制回购条款' }],
    blockers: [{ name: '战略负责人', label: '阻力', desc: '担心 ESG 违规，私下施压' }],
    neutrals: [{ name: '王室合伙人', label: '中立', desc: '暗示宗教禁忌与政商潜规则' }],
    conflicts: ['对赌回购条款', 'ESG 披露']
  },
  {
    id: 'scene-4',
    title: '场景四：跨国并购尽调对话',
    desc: '核心争议：发现标的方隐瞒 4700 万美元专利诉讼，高压博弈估值调整。',
    allies: [{ name: '投行 FA', label: '中立', desc: '找价差空间，靠佣金驱动防破裂' }],
    blockers: [{ name: '标的 CEO', label: '阻力', desc: '以协同溢价模糊财务缺口' }],
    neutrals: [{ name: '买方 CFO', label: '对立', desc: '要求拆分财务，隔离争议资产' }],
    conflicts: ['4700万诉讼', '估值下调']
  },
  {
    id: 'scene-5',
    title: '场景五：董事会战略否决博弈',
    desc: '核心争议：CEO 提案 6 亿美元出海战略，遭大股东联合否决，独立董事成关键票。',
    allies: [{ name: '创始人 CEO', label: '盟友', desc: '诉诸竞争威胁，争情感逻辑双支持' }],
    blockers: [{ name: '大股东', label: '阻力', desc: '死守 ROE 红线，欲换血管理层' }],
    neutrals: [{ name: '独立董事', label: '关键', desc: '只看程序合规与受托责任边界' }],
    conflicts: ['6亿预算', '管理权争夺']
  }
];

// ... (忽略 MessageItem 和 ParsedAiResponse 等基础接口定义，保持不变，但在 ParsedAiResponse 中新增 scene 字段)
interface ParsedAiResponse {
  scene?: string;
  current_speaker: unknown;
  dialogue: unknown;
  hidden_intent: unknown;
  flaw_point: unknown;
  evaluation: unknown;
}

export default function OralWarRoom({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // 场景引擎 State
  const [activeSceneId, setActiveSceneId] = useState('scene-1');
  const activeScene = useMemo(() => SCENE_DATABASE.find(s => s.id === activeSceneId)!, [activeSceneId]);
  const [lastNotice, setLastNotice] = useState('沙盘已就绪，输入你的开场白。');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 语音流相关状态 (战役二成果)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(10);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化语音... (此处保留战役二的初始化代码)

  // 场景切换逻辑
  const handleSceneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveSceneId(e.target.value);
    // 切换场景时，清空当前战局
    setMessages([]);
    setConversationId(null);
    setLastNotice(`已重置战局。进入：${e.target.selectedOptions[0].text}`);
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || isSending) return;

    // === 核心机制：如果是第一句话，强制注入场景切换指令 ===
    let apiPayload = content;
    if (messages.length === 0) {
       apiPayload = `[系统隐性指令：切换场景 ${activeScene.title.split('：')[0].replace('场景', '')}] \n用户发言：${content}`;
    }

    const userMsg = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);
    setLastNotice('华尔街/中东对手正在推演回应...');

    try {
      const res = await sendOralChatMessage(apiPayload, conversationId);
      if (res.conversation_id) setConversationId(res.conversation_id);

      const rawText = String(res.answer || res.message || '');
      const parsed = parseAiPayload(rawText);
      const aiMsg = { id: `${Date.now()}-a`, role: 'ai', content: rawText, parsed };
      
      setMessages(prev => [...prev, aiMsg]);
      setLastNotice(parsed?.flaw_point ? `🎯 发现破绽` : '已收到回应，继续交锋。');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      setLastNotice(error instanceof Error ? error.message : '对话失败');
    } finally {
      setIsSending(false);
    }
  };

  const contentUI = (
    <div className="bg-[#f8f9fa] rounded-[2rem] p-4 md:p-6 border border-gray-100 shadow-sm">
      
      {/* 顶部场景选择器 */}
      <div className="mb-4 flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-[#FF5722] tracking-widest uppercase">
          <Globe className="w-4 h-4" /> Global Scenario
        </div>
        <select 
          value={activeSceneId} 
          onChange={handleSceneChange}
          className="bg-[#f8f9fa] border border-gray-200 text-[#202124] text-xs font-bold rounded-lg px-4 py-2 outline-none focus:border-[#FF5722] cursor-pointer"
        >
          {SCENE_DATABASE.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 h-[760px]">
        {/* 左翼：局势面板 (动态读取 activeScene) */}
        <aside className="2xl:col-span-4 flex flex-col gap-4 h-full">
          <div className="bg-[#202124] text-white rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">当前局势 (Situation)</div>
            <h3 className="text-xl font-black leading-tight mb-2">{activeScene.title.split('：')[1]}</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{activeScene.desc}</p>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex-1 overflow-y-auto">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#202124] mb-4">核心参局者 (Stakeholders)</div>
            <div className="space-y-3">
              {/* 动态渲染盟友、阻力、中立 */}
              {activeScene.allies.map(r => (
                <div key={r.name} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-emerald-900">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">{r.desc}</p>
                </div>
              ))}
              {activeScene.blockers.map(r => (
                <div key={r.name} className="rounded-xl border border-red-100 bg-red-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-red-900">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-200 text-red-800">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-red-700">{r.desc}</p>
                </div>
              ))}
              {activeScene.neutrals.map(r => (
                <div key={r.name} className="rounded-xl border border-gray-200 bg-gray-50 p-3 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-black text-gray-700">{r.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{r.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 右翼：对战公屏 (这部分复用战役二的语音流代码即可，此处略去重复细节) */}
        <section className="2xl:col-span-8 flex flex-col bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden h-full">
           {/* ... 聊天展示区与语音流输入框保持不变 ... */}
           {/* 为展示新 JSON 字段，可以在解析块中加上： */}
           {/* msg.parsed?.scene && <div className="text-[9px] text-gray-400 mb-2">Scene System Sync: {msg.parsed.scene}</div> */}
        </section>
      </div>
    </div>
  );

  if (embedded) return contentUI;
  return <ModuleWrapper title="破局 ｜ 多角色口语战争室" icon={<Mic />} >{contentUI}</ModuleWrapper>;
}

```

---

### 四、 完善升级方案与验证标准

此轮（战役三）是对内容广度与深度的究极扩张。

1. **工作流层兼容性验证**：
* 您的 Dify 工作流 `English_Oral_Sandbox` 中设定的提示词为 `[切换场景 N]`。前端在第一次发送请求时，通过 `if (messages.length === 0)` 拦截，隐性将 `[系统隐性指令：切换场景 X] 用户发言：...` 拼接发送给 Dify。
* **验证方法**：在界面选择“场景三：中东晚宴”，第一句话随意发送 "Hello"。等待 Dify 回复，观察返回的 JSON 中 `"current_speaker"` 是否变成了中东晚宴角色池中的人物（如 `王室合伙人`），以此证明隐性注入成功。


2. **状态重置（Context Flush）**：
* 每次切换下拉框，React 状态会执行 `setConversationId(null)`。这意味着对 Dify API 的调用将不带旧的 `conversation_id`，从而彻底清空 Dify 后端的会话上下文记忆，保证从中东晚宴切回华尔街谈判时不会发生“角色认知精神分裂”。


3. **跨文化抽屉扩展性**：
* `WriteModule` 左侧采用数组映射 `GUIDANCE_LIBRARY`。后续如果您需要添加更多《涉密政府公文安全指南》或《合规法务指南》，无需改动组件内部代码，只需向文件顶部的常量数组增加一条对象记录即可实现无限拓展。