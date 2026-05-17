import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, Globe, Mic, MicOff, Send, ShieldAlert, Target, Users } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { sendOralChatMessage } from '../../services/difyAPI';
import { createTrainingAttempt } from '../../services/trainingAPI';

// === 5 大高压场景字典 ===
const SCENE_DATABASE = [
  {
    id: 'scene-1',
    title: '场景一：国际银团贷款谈判',
    desc: '核心争议：利率上浮 0.5% 与抵押物权属争议。借款方资金缺口倒逼 72 小时谈判时限。',
    allies: [{ name: 'CEO', label: '盟友', desc: '极力推动落地，愿让步换时间' }],
    blockers: [{ name: 'CFO', label: '阻力', desc: '严控 IRR 红线，要求重跑估值' }],
    neutrals: [{ name: '监管方', label: '中立', desc: '只关注合规证据与权属文件' }],
    conflicts: ['利率上浮 0.5%', '抵押物权属'],
    culturalContext: '美系主导（Action-oriented, Direct）。切忌过分谦逊，直面利益冲突并明确亮出 Bottom Line。'
  },
  {
    id: 'scene-2',
    title: '场景二：危机公关媒体发布会',
    desc: '核心争议：亚太子公司环保数据造假，监管介入，各方博弈信息披露边界。',
    allies: [{ name: '公关总监', label: '盟友', desc: '试图用技术性误差推锅给第三方' }],
    blockers: [{ name: '法务官', label: '阻力', desc: '警告承认将触发天价罚款' }],
    neutrals: [{ name: '财经记者', label: '对立', desc: '掌握邮件截图，紧逼决策链' }],
    conflicts: ['数据造假责任', '披露边界'],
    culturalContext: '欧系合规文化（Regulation-first）。强调程序正义与透明度，切忌掩盖或使用含糊用词，以免触发公关灾难。'
  },
  {
    id: 'scene-3',
    title: '场景三：中东商务晚宴谈判',
    desc: '核心争议：主权基金新能源开发，核心条款在礼仪博弈中暗中交锋。',
    allies: [{ name: '投资总监', label: '盟友', desc: '用家族荣誉包装强制回购条款' }],
    blockers: [{ name: '战略负责人', label: '阻力', desc: '担心 ESG 违规，私下施压' }],
    neutrals: [{ name: '王室合伙人', label: '中立', desc: '暗示宗教禁忌与政商潜规则' }],
    conflicts: ['对赌回购条款', 'ESG 披露'],
    culturalContext: '中东政商文化（Relationship & Hierarchy）。重视关系与家族荣誉，避免当众逼迫对方妥协，注意预留谈判台阶。'
  },
  {
    id: 'scene-4',
    title: '场景四：跨国并购尽调对话',
    desc: '核心争议：发现标的方隐瞒 4700 万美元专利诉讼，高压博弈估值调整。',
    allies: [{ name: '投行 FA', label: '中立', desc: '找价差空间，靠佣金驱动防破裂' }],
    blockers: [{ name: '标的 CEO', label: '阻力', desc: '以协同溢价模糊财务缺口' }],
    neutrals: [{ name: '买方 CFO', label: '对立', desc: '要求拆分财务，隔离争议资产' }],
    conflicts: ['4700万诉讼', '估值下调'],
    culturalContext: '英系保守主义（Risk-averse）。极端注重细节与免责声明，警惕对方通过冗长模糊的法律条款设置陷阱。'
  },
  {
    id: 'scene-5',
    title: '场景五：董事会战略否决博弈',
    desc: '核心争议：CEO 提案 6 亿美元出海战略，遭大股东联合否决，独立董事成关键票。',
    allies: [{ name: '创始人 CEO', label: '盟友', desc: '诉诸竞争威胁，争情感逻辑双支持' }],
    blockers: [{ name: '大股东', label: '阻力', desc: '死守 ROE 红线，欲换血管理层' }],
    neutrals: [{ name: '独立董事', label: '关键', desc: '只看程序合规与受托责任边界' }],
    conflicts: ['6亿预算', '管理权争夺'],
    culturalContext: '多边复合博弈（Consensus-building）。需同时识别中、美、欧不同利益方的底层诉求，平衡短期利益与长期战略，避免陷入单点争论。'
  }
];

interface ParsedAiResponse {
  scene?: string;
  current_speaker: unknown;
  dialogue: unknown;
  hidden_intent: unknown;
  flaw_point: unknown;
  evaluation: unknown;
}

interface MessageItem {
  id: string;
  role: 'user' | 'ai';
  content: string;
  parsed?: ParsedAiResponse | null;
}

function stripMarkdownJson(text: string) {
  return String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();
}

function parseAiPayload(raw: string): ParsedAiResponse | null {
  try {
    return JSON.parse(stripMarkdownJson(raw));
  } catch {
    return null;
  }
}

function safeText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface OralWarRoomProps {
  embedded?: boolean;
  /** 与 training_attempts.scene_type 对齐，用于主题通关统计 */
  sceneTheme?: string;
  sessionId?: string | null;
  userId?: string;
  onOralRoundLogged?: () => void;
}

export default function OralWarRoom({
  embedded = false,
  sceneTheme = '',
  sessionId = null,
  userId = 'default-user',
  onOralRoundLogged,
}: OralWarRoomProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState('沙盘已就绪，输入你的开场白。');
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── 语音引擎 & 高压倒计时 ─────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(10);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTextRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      pendingTextRef.current = transcript;
      setInputText(transcript);
    };
    rec.onerror = () => stopRecording();
    recognitionRef.current = rec;
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isSending) return;
    pendingTextRef.current = '';
    setInputText('');
    setRecordingTime(10);
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch { return; }
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev <= 1) {
          stopRecording();
          // 倒计时耗尽：自动截断并发送
          setTimeout(() => {
            const text = pendingTextRef.current.trim();
            if (text) {
              setInputText(text);
              handleSendWithText(text);
            }
          }, 550);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isSending, stopRecording]);

  // 松手即发送：直接传文本给 handleSend，不依赖异步 state
  const stopRecordingAndSend = useCallback(() => {
    stopRecording();
    setTimeout(() => {
      const text = pendingTextRef.current.trim();
      if (text) {
        setInputText(text);
        // 直接传入文本，不等待 inputText state 更新
        handleSendWithText(text);
      }
    }, 550);
  }, [stopRecording]);
  // ─────────────────────────────────────────────────────────

  // 场景引擎 State
  // 新增：全局 theme 到场景 ID 的映射
  const themeToSceneMap: Record<string, string> = {
    '商务谈判：让步与施压': 'scene-1',
    '危机公关：外媒答疑': 'scene-2',
    '项目汇报：跨国董事会': 'scene-5',
  };

  const [activeSceneId, setActiveSceneId] = useState(() => {
    if (embedded && sceneTheme && themeToSceneMap[sceneTheme]) {
      return themeToSceneMap[sceneTheme];
    }
    return 'scene-1';
  });

  useEffect(() => {
    if (embedded && sceneTheme && themeToSceneMap[sceneTheme]) {
      const nextId = themeToSceneMap[sceneTheme];
      if (nextId !== activeSceneId) {
        setActiveSceneId(nextId);
        setMessages([]);
        setConversationId(null);
        setLastNotice(`已根据全局指令切换战局。进入：${SCENE_DATABASE.find(s => s.id === nextId)?.title}`);
      }
    }
  }, [embedded, sceneTheme]);

  const activeScene = useMemo(() => SCENE_DATABASE.find(s => s.id === activeSceneId)!, [activeSceneId]);

  // 场景切换逻辑
  const handleSceneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveSceneId(e.target.value);
    setMessages([]);
    setConversationId(null);
    setLastNotice(`已重置战局。进入：${e.target.selectedOptions[0].text}`);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // 核心发送逻辑（接受显式文本，不依赖 inputText state 异步更新）
  const handleSendWithText = async (forceContent: string) => {
    const content = forceContent.trim();
    if (!content || isSending) return;

    // === 核心机制：如果是第一句话，强制注入场景切换指令 ===
    let apiPayload = content;
    const diff = localStorage.getItem('super_agent_global_diff') || 'standard';
    const difficultyPrefix = diff === 'hardcore' ? '【全局指令：当前为极限施压模式，请在回复中表现出极强的压迫感、敌意与找破绽倾向，不可轻易让步。】\n' : '';

    if (messages.length === 0) {
       apiPayload = `[系统隐性指令：切换场景 ${activeScene.title.split('：')[0].replace('场景', '')}]\n${difficultyPrefix}用户发言：${content}`;
    } else {
       apiPayload = `${difficultyPrefix}用户发言：${content}`;
    }

    const userMsg: MessageItem = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    pendingTextRef.current = '';
    setIsSending(true);
    setLastNotice('华尔街/中东对手正在推演回应...');

    try {
      const res = await sendOralChatMessage(apiPayload, conversationId);
      if (res.conversation_id) setConversationId(res.conversation_id);

      const rawText = String(res.answer || res.message || '');
      const parsed = parseAiPayload(rawText);
      const aiMsg: MessageItem = { id: `${Date.now()}-a`, role: 'ai', content: rawText, parsed };
      setMessages(prev => [...prev, aiMsg]);

      if (sessionId && sceneTheme) {
        void createTrainingAttempt({
          sessionId,
          userId,
          moduleType: 'oral',
          sceneType: sceneTheme,
          caseText: content.slice(0, 800),
          userAnswer: { round: 'user_turn', conversationId: res.conversation_id || null },
          durationSeconds: 0,
          score: null,
        })
          .then(() => onOralRoundLogged?.())
          .catch(() => {});
      }

      if (parsed?.flaw_point) {
        setLastNotice('🎯 已识别破绽，见上方红色卡片 ↑');
      } else {
        setLastNotice('已收到回应，继续追问。');
      }
      scrollToBottom();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '对话失败';
      setLastNotice(msg);
    } finally {
      setIsSending(false);
    }
  };

  // 键盘发送：读取当前 inputText state
  const handleSend = () => handleSendWithText(inputText);

  const content = (
    <div className="bg-[#f8f9fa] rounded-[2rem] xl:rounded-[2.5rem] p-3 sm:p-4 md:p-6 border border-gray-100 shadow-sm">
      
      {/* 战术使用指南 SOP */}
      <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm mb-4">
        <div className="bg-rose-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-rose-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-rose-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-rose-600 mr-2">操作说明：</span>长按下方麦克风语音反击，或打字回复。沙盘会根据当前 Theme 自动锁定剧本。倒计时 10 秒内必须给出回应。</div>
            <div><span className="font-black text-rose-600 mr-2">功能亮点：</span>多方势力动态对抗。AI 同步扮演发难者与盟友，配以不同音调的声纹特征，对您进行跨文化和权力的双重极限施压。</div>
            <div><span className="font-black text-rose-600 mr-2">生态定位：</span>【肌肉记忆】消化所有前置弹药。强迫您在毫秒级的高压对抗中，建立直觉性的、不打草稿的商务谈判反击能力。</div>
          </div>
        </div>
      </div>
      
      {/* 顶部场景选择器 */}
      {!embedded && (
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
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 xl:gap-6 h-auto 2xl:h-[760px]">
        {/* 左翼：局势面板 (动态读取 activeScene) */}
        <aside className="2xl:col-span-4 flex flex-col gap-4 h-full">
          <div className="bg-[#202124] text-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-[#FF5722]/15 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-[#FF5722]" /> 当前局势 (Situation)
              </div>
              <h3 className="text-xl font-black leading-tight mb-2">{activeScene.title.split('：')[1]}</h3>
              <p className="text-xs text-gray-300 leading-relaxed">{activeScene.desc}</p>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] xl:rounded-[2rem] p-5 xl:p-6 border border-gray-100 shadow-sm flex-1 overflow-y-auto">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#FF5722]" /> 核心参局者 (Stakeholders)
            </div>
            <div className="space-y-3">
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

          {/* 跨文化语境预警 */}
          {activeScene.culturalContext && (
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest mb-4 flex items-center">
                <Globe className="w-4 h-4 mr-2" /> 跨文化预警 (Cultural Context)
              </h3>
              <p className="text-sm text-purple-800 leading-relaxed font-medium">{activeScene.culturalContext}</p>
            </div>
          )}

          {/* 战场动态情报 */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">冲突点</div>
            <div className="flex flex-wrap gap-2">
              {activeScene.conflicts.map(c => (
                <span key={c} className="px-3 py-1 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-[11px] font-black uppercase tracking-widest">{c}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="2xl:col-span-8 flex flex-col bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden h-[680px] sm:h-[720px] 2xl:h-full">
          <div className="p-5 border-b border-gray-100 bg-[#f8f9fa] flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-1">对抗通信通道</div>
              <h4 className="text-lg font-black text-[#202124]">实时解析 AI 破绽并引导反击</h4>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-gray-500 bg-white rounded-full px-3 py-2 border border-gray-200">
              {isSending ? '对手推演中' : '待命'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-white to-[#f8f9fa]">
            {messages.length === 0 ? (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-gray-400 text-center px-6">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">输入你的开场白，激活对手角色并捕捉逻辑破绽。</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[82%] rounded-3xl rounded-tr-md bg-[#202124] text-white px-5 py-4 shadow-md">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">你</div>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-[92%] rounded-3xl rounded-tl-md bg-white border border-gray-100 px-5 py-4 shadow-sm">
                      {msg.parsed ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              {safeText(msg.parsed.current_speaker)}
                            </span>
                          </div>

                          <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4 mb-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Dialogue</p>
                              <SpeakButton text={safeText(msg.parsed.dialogue)} title="播放 AI 英文发言" />
                            </div>
                            <p className="text-sm leading-relaxed text-[#202124] italic">“{safeText(msg.parsed.dialogue)}”</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Hidden Intent</div>
                              <p className="text-sm text-blue-900 leading-relaxed">{safeText(msg.parsed.hidden_intent)}</p>
                            </div>
                            <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">🎯 发现破绽</div>
                              <p className="text-sm text-red-900 leading-relaxed">{safeText(msg.parsed.flaw_point || '未识别到破绽')}</p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Evaluation</div>
                            <p className="text-sm text-emerald-900 leading-relaxed">{safeText(msg.parsed.evaluation)}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              AI
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                              <AlertTriangle className="w-3 h-3" /> 解析失败
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 p-5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="text-sm font-bold text-[#202124]">{lastNotice}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">当前局势：{activeScene.conflicts.join(' / ')}</div>
            </div>
            <div className="relative flex flex-col">
              {/* 高压 10 秒倒计时 */}
              {isRecording && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10
                               bg-red-500 text-white px-5 py-2 rounded-full text-xs font-black
                               tracking-widest uppercase flex items-center gap-2
                               shadow-[0_4px_20px_rgba(239,68,68,0.55)] animate-pulse whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5" /> 剩余 {recordingTime} 秒脱口而出
                </div>
              )}
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                className={`w-full rounded-3xl border-2 px-5 py-4 pr-48 text-sm text-[#202124]
                           outline-none resize-none transition-colors
                           ${ isRecording
                               ? 'border-red-400 bg-red-50/40 placeholder-red-300'
                               : 'border-gray-200 bg-[#f8f9fa] focus:border-[#FF5722]' }`}
                placeholder={isRecording ? '🎙 正在倾听您的反击...' : '长按麦克风说话，或直接输入破局发言...'}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {/* 麦克风长按按钮 */}
                {speechSupported ? (
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecordingAndSend}
                    onMouseLeave={() => { if (isRecording) stopRecordingAndSend(); }}
                    onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopRecordingAndSend(); }}
                    disabled={isSending}
                    className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest
                               transition-all select-none flex items-center gap-2
                               ${ isRecording
                                   ? 'bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.6)] scale-105'
                                   : 'bg-gray-100 text-gray-600 hover:bg-gray-200' }`}
                  >
                    {isRecording
                      ? <><MicOff className="w-4 h-4 animate-bounce" /> 松开发送</>  
                      : <><Mic className="w-4 h-4" /> 长按说话</>}
                  </button>
                ) : null}
                <button
                  onClick={handleSend}
                  disabled={isSending || !inputText.trim() || isRecording}
                  className="rounded-2xl bg-[#202124] text-white px-4 py-3 text-xs font-black
                             uppercase tracking-widest hover:bg-[#FF5722] transition-colors
                             disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> 发送
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <ModuleWrapper
      title="破局 ｜ 多角色口语战争室"
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="左侧常驻显示局势、角色与冲突点；右侧进行多角色对抗对话，并自动标记 AI 返还的逻辑破绽。"
    >
      {content}
    </ModuleWrapper>
  );
}
