# Dify 驱动的商务英语训练引擎

**Date**: May 16, 2026 at 07:19 PM
**Turns**: 1
**Source**: [Gemini Chat](https://gemini.google.com/app/010d731f91d4c16a)

---

## Turn 1



分析实现如下需求，给出具体的实现方案，包括待完善文档目录结构、文件名称、新增或修改标识、参考代码等。
一、 UI/UX 体验提升情况 (前端界面重构)
为了匹配您对于“高阶商务质感”与“极度克制”的审美要求，系统前端彻底抛弃了传统的聊天界面和弹窗堆叠模式，实现了以下重大提升：
废除嵌套模态框，采用70/30空间折叠布局（全局主控台 DashboardShell.tsx）：
系统抛弃了繁琐的居中弹窗，采用70%左侧主工作区（用于高阶政商长文阅读、多维表单输入）与30%右侧动态滑出面板（Context Sheet）的黄金比例布局。当您需要深度解析生词或分析职场“潜台词”时，右侧会平滑滑出解析面板，目光只需左移即可比对原文，实现了零认知摩擦和随时收放的信息掌控感。
强制控制论任务闭环（Cybernetic Closed-Loops）：
取代了看完即忘的“开环聊天流水线”，UI中引入了“动态任务收件箱”（Active Cognitive Loops）。当AI在英语交互中发现您的逻辑破绽或表达分寸不当时，会在顶层生成一个必须处理的“微任务卡片”（如强制重写一段英文反问句）。只有您按要求完成并达标后，UI进度条才会解锁闭环，变被动阅读为高压刻意练习。
极简的高端商务美学：
全面采用Shadcn UI组件库与Tailwind CSS，抛弃高饱和度色彩和廉价装饰，使用低调的冷灰调（Zinc或Slate色系）与大面积留白。仅在核心逻辑节点使用唯一的深邃靛蓝色进行强调，配合全局命令面板（Ctrl+K快速呼出工具），呈现出顶级外企软件的严肃权威感。
二、 核心业务需求满足情况 (后端Dify逻辑链实现)
现有的后端代码逻辑已经通过Dify引擎的DSL（领域特定语言）文件进行了深度重构，完美承接了前期的英语战略目标：
1. 听力分析与跨文化心理侧写（多角色博弈与找破绽）—— ✅ 高度满足
实现方式： 通过部署 listen_analysis_chatflow.yml 引擎。
功能对应： 针对您要求的“识别盟友与阻力”、“找破绽”与“识别弦外之音”，系统在您提交语料前，强制要求您输入三个前置变量：scene_type（物理与社会环境）、role_judgement（权力层级判断）和intent_judgement（真实诉求潜台词）。
结果： AI接收这些变量后，会输出结构化洞察报告（包含权力博弈分析、跨文化潜台词解码），并指导您起草一句符合当前站位高度的“极度克制的英文反问句”，完美满足您“精准提问与找破绽”的高管沟通需求。
2. 词汇阅读与双区生词本闭环 —— ✅ 深度拓展满足
实现方式： 通过部署 dict_tool_workflow.yml 双轨制智能词典工作流。
功能对应： 满足了生词划分“政商务”与“全场景”的需求。当您遇到盲点时，词典工作流提供条件路由：选择 en_en_business 模式则提供哈佛商学院级别的高阶商务解析；选择 en_zh_bidirectional 则提供CATTI二级难度的双语分寸度对比。
结果： 系统引入了 user_context（用户上下文）变量，生成的例句会强制与您当前的真实业务场景绑定（如起草跨部门邮件），让词汇真正落地到实战应用。
3. 全局进度追踪与能力动态调参（掌握度判定机制）—— ✅ 核心突破
实现方式： 利用Dify v0.6+的持久化会话变量（Conversation Variables）和 variable_assigner 节点。
功能对应： 您提出的“严格的主题通关机制”与“阶段反馈”在此得到了根本性解决。系统定义了 User_Current_Profile 全局持久化数组变量。
结果： 每次交互后，系统提取您的认知短板或进步（如：“在解读中东客户意图时过于字面化”）并存入该雷达图。在接下来的模拟谈判或口语对话中，Agent会动态调高针对性训练的难度，确保训练不仅不松散，反而极度严密地追踪您的能力演进轨迹。
总结：
整体来看，通过前端非对称布局与强制闭环任务卡，结合后端Dify的持续化记忆（User_Current_Profile）与定制工作流（DSL），您的英语能力训练体系已经完全超越了常规语言学习软件，成功重构为一个具备高阶商业审美、专注于跨文化博弈与人性侧写的决策者级训练引擎。

### 🤖 Assistant

为了将“高阶商务质感”的UI/UX体验与Dify底层的深度业务逻辑完美融合，以下是针对superme项目的具体技术落地实施方案。本方案将彻底废弃原有的离散式本地服务，转向基于Dify编排引擎的云端/私有化后端，以及基于React + Tailwind CSS + Shadcn UI的现代化前端架构。

---

### 一、 待完善文档目录结构与重构标识
现有的物理代码库需要进行深度的规范化清理，剥离陈旧的后端本地逻辑，全面拥抱前端视图层与Dify API的中台化对接。

```plaintext
superme/
├── .agents/                 [删除] (逻辑上移至 Dify 编排引擎)
├── vocab-server/            [删除] (彻底废弃，词汇管理交由 Dify Workflow 与持久化变量)
├── yml/                     [修改] (集中管理 Dify 导出的 DSL 文件)
│   ├── listen_analysis_chatflow.yml  [新增] (跨文化听力与破绽分析引擎)
│   ├── dict_tool_workflow.yml        [新增] (双轨制智能词典工作流)
│   └── ...
├── src/                     [修改] (前端工程核心目录重组)
│   ├── app/                 [新增] (Next.js App Router 或页面级路由)
│   │   ├── layout.tsx       [新增] (全局布局)
│   │   └── page.tsx         [新增] (主控台入口)
│   ├── components/          [新增] (UI 组件库)
│   │   ├── ui/              [新增] (存放 Shadcn UI 基础组件：Sheet, Button, Card等)
│   │   ├── layout/          [新增] (核心布局组件)
│   │   │   ├── DashboardShell.tsx    [新增] (70/30 比例的折叠主控台)
│   │   │   └── Sidebar.tsx           [新增] (左侧极简导航)
│   │   ├── chat/            [新增] (对话与闭环组件)
│   │   │   ├── DifyChatInterface.tsx [新增] (流式对话与打字机特效渲染)
│   │   │   └── CognitiveLoopCard.tsx [新增] (控制论强制闭环任务卡片)
│   │   └── tools/           [新增] (右侧 30% 面板工具组件)
│   │       └── SubtextAnalysisPanel.tsx [新增] (潜台词与破绽分析展示面板)
│   ├── lib/                 [新增] (核心工具类)
│   │   ├── dify/            [新增] (Dify API 交互层)
│   │   │   ├── client.ts    [新增] (封装 Dify Messages/Workflows API)
│   │   │   └── session.ts   [新增] (管理 sys.user_id 与 sys.conversation_id)
│   │   └── utils.ts         [新增] (Tailwind 类名合并等通用工具)
│   └── hooks/               [新增] (自定义状态管理)
│       ├── useDifyChat.ts   [新增] (处理大模型流式输出与状态追踪)
│       └── useTaskLoop.ts   [新增] (追踪强制微任务的完成状态)
├── package.json             [修改] (新增 tailwindcss, class-variance-authority, lucide-react 等依赖)
└── tailwind.config.js       [新增] (配置冷灰调 Zinc/Slate 高级商务色彩规范)

```

---

### 二、 核心前端架构参考代码

#### 1. 70/30 空间折叠布局 (DashboardShell.tsx)
此组件通过 Shadcn UI 的 `Sheet` 原语实现右侧 30% 分析面板的平滑滑出，消灭居中模态框嵌套，保持左侧主工作区可见。

```typescript
import React, { useState } from 'react';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DifyChatInterface } from '@/components/chat/DifyChatInterface';
import { SubtextAnalysisPanel } from '@/components/tools/SubtextAnalysisPanel';
import { Menu, BookOpen, Briefcase, BrainCircuit } from 'lucide-react';

export default function DashboardShell() {
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  const [activeFocusText, setActiveFocusText] = useState<string | null>(null);

  // 触发破绽分析或深层词汇解析
  const handleDeepDiveRequest = (text: string) => {
    setActiveFocusText(text);
    setIsAnalysisPanelOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 overflow-hidden font-sans text-zinc-900">
      
      {/* 极简左侧导航栏 (缩缩版) */}
      <aside className="w-20 border-r border-zinc-200 bg-white flex flex-col items-center py-6 gap-8">
        <div className="w-10 h-10 bg-indigo-950 text-white rounded-lg flex items-center justify-center font-bold text-xl">
          S
        </div>
        <nav className="flex flex-col gap-6 text-zinc-400">
          <button className="hover:text-indigo-900 transition-colors"><Briefcase size={24} /></button>
          <button className="hover:text-indigo-900 transition-colors"><BookOpen size={24} /></button>
          <button className="hover:text-indigo-900 transition-colors"><BrainCircuit size={24} /></button>
        </nav>
      </aside>

      {/* 中央主工作区 (70% 视窗) */}
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out px-12 py-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-light tracking-tight text-zinc-800">跨国并购意向谈判推演</h1>
          <p className="text-sm text-zinc-500 mt-2 tracking-wide">Scene: Formal Boardroom | Role: VP of Operations</p>
        </header>

        {/* 流式聊天与核心交互接口 */}
        <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm p-6">
          <DifyChatInterface onDeepDive={handleDeepDiveRequest} />
        </div>
      </main>

      {/* 右侧 30% 动态上下文面板 (Context Sheet) */}
      <Sheet open={isAnalysisPanelOpen} onOpenChange={setIsAnalysisPanelOpen}>
        <SheetContent 
          side="right" 
          className="w-[30vw] min-w-[400px] bg-white border-l border-zinc-200 p-0 shadow-2xl sm:max-w-none"
        >
          {activeFocusText && (
             <SubtextAnalysisPanel 
                focusText={activeFocusText} 
                onClose={() => setIsAnalysisPanelOpen(false)} 
             />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

```

#### 2. 控制论强制闭环任务卡 (CognitiveLoopCard.tsx)
用于替代传统的开放式对话。当大模型判定用户的回复存在逻辑漏洞或分寸失当时，触发此强制任务卡片，未完成前冻结主线推进。

```typescript
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoopCardProps {
  insight: string;           // Dify 返回的逻辑短板诊断
  taskRequirement: string;   // 强制重写或改写的具体要求
  onLoopClosed: (revisedText: string) => Promise<boolean>; // 提交给 Dify 验证
}

export function CognitiveLoopCard({ insight, taskRequirement, onLoopClosed }: LoopCardProps) {
  const [input, setInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsVerifying(true);
    const passed = await onLoopClosed(input);
    setIsVerifying(false);
    if (passed) {
      setIsResolved(true);
    }
  };

  if (isResolved) {
    return (
      <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-4 rounded-lg border border-emerald-100 my-4">
        <CheckCircle2 size={20} />
        <span className="text-sm font-medium tracking-wide">认知闭环已达成：表达分寸已修正。</span>
      </div>
    );
  }

  return (
    <Card className="border-indigo-100 bg-indigo-50/30 shadow-none my-6 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <AlertCircle size={18} className="text-indigo-700" />
        <CardTitle className="text-sm font-semibold text-indigo-900 tracking-wide">强制微任务：逻辑/分寸修正</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-zinc-700 leading-relaxed">
          <strong className="block text-zinc-900 mb-1">系统诊断：</strong>
          {insight}
        </div>
        <div className="text-sm text-zinc-700 leading-relaxed">
          <strong className="block text-zinc-900 mb-1">重构要求：</strong>
          {taskRequirement}
        </div>
        <Textarea 
          placeholder="在此处输入修正后的英文表达..."
          className="min-h-[100px] resize-none bg-white border-zinc-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isVerifying}
        />
      </CardContent>
      <CardFooter className="pt-0 justify-end">
        <Button 
          onClick={handleSubmit} 
          disabled={isVerifying || !input.trim()}
          className="bg-indigo-950 text-white hover:bg-indigo-900 px-6"
        >
          {isVerifying ? '验证中...' : '提交验证并闭环'}
        </Button>
      </CardFooter>
    </Card>
  );
}

```

#### 3. Dify API 客户端封装桥接 (src/lib/dify/client.ts)
取代直接在前端硬编码请求，将 `conversation_id` 和会话变量的管理封装在中转层，实现持续的上下文追踪。

```typescript
// src/lib/dify/client.ts
const DIFY_API_URL = process.env.NEXT_PUBLIC_DIFY_API_URL || 'https://api.dify.ai/v1';

export class DifyClient {
  private apiKey: string;
  private userId: string;

  constructor(apiKey: string, userId: string = 'superme_admin_01') {
    this.apiKey = apiKey;
    this.userId = userId;
  }

  /**
   * 调用 Chatflow/Agent 进行带有持久化记忆的对话
   */
  async sendMessage(
    query: string, 
    conversationId: string | null = null,
    inputs: Record<string, any> = {} // 传入 scene_type, role_judgement 等必填坐标
  ) {
    const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        query,
        response_mode: 'streaming',
        conversation_id: conversationId || "",
        user: this.userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dify API Request Failed: ${response.statusText}`);
    }

    return response.body; // 交由前端 Hooks 处理 SSE 流式渲染
  }

  /**
   * 调用单次 Workflow (例如字典工具)
   */
  async runWorkflow(inputs: Record<string, any>) {
    const response = await fetch(`${DIFY_API_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        response_mode: 'blocking',
        user: this.userId,
      }),
    });
    return response.json();
  }
}

```

---

*Exported from [Voyager](https://github.com/Nagi-ovo/gemini-voyager)*  
*Generated on May 16, 2026 at 07:19 PM*