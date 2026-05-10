import React, { useState } from 'react';
import { Globe, Mic, Volume2, Target, CheckCircle2, Zap, PenTool, BookOpen, Clock, AlertTriangle, Loader2, PlayCircle, FastForward, Eye, EyeOff, Headphones } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import MaterialUploader from '../MaterialUploader';
import { runEnglishWriteReview, sendOralChatMessage, runEnglishListenEngine } from '../../services/difyAPI';

type EnglishTab = 'dashboard' | 'vocab' | 'listen' | 'oral' | 'write';

const SUB_TABS = [
  { id: 'dashboard', label: '进度总控', icon: <Target className="w-4 h-4" /> },
  { id: 'vocab',     label: '词汇矩阵',   icon: <BookOpen className="w-4 h-4" /> },
  { id: 'listen',    label: '精听盲听',   icon: <Volume2 className="w-4 h-4" /> },
  { id: 'oral',      label: '多角色沙盘', icon: <Mic className="w-4 h-4" /> },
  { id: 'write',     label: '纵深书面',   icon: <PenTool className="w-4 h-4" /> },
] as const;

const ReviewCard = ({ title, content, isLoading, color = 'text-gray-500', isDark = false, optimized = '' }: any) => (
  <div className={`rounded-2xl p-6 border flex-1 ${isDark ? 'bg-[#202124] text-white border-gray-800' : 'bg-white border-gray-100'}`}>
    <h5 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-[#FF5722]' : color}`}>
      {title}
    </h5>
    {isLoading ? (
      <p className="text-sm text-gray-400 italic">Dify 正在审阅中...</p>
    ) : content ? (
      <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{content}</p>
    ) : (
      <p className="text-sm text-gray-400 italic">等待提交分析...</p>
    )}
    {isDark && optimized && (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <h5 className="text-[10px] font-black uppercase tracking-widest mb-3 text-[#FF5722]">
          AI 高管级示范文本 (Optimized Version)
        </h5>
        <p className="text-sm text-gray-300 leading-relaxed italic">{optimized}</p>
      </div>
    )}
  </div>
);

export default function EnglishModule() {
  const [activeTab, setActiveTab] = useState<EnglishTab>('dashboard');
  const [stage, setStage] = useState<'0-6' | '6-12'>('0-6');
  const [theme, setTheme] = useState('商务谈判：让步与施压');
  const [isMastered, setIsMastered] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [writeIntent, setWriteIntent] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [wordLimit, setWordLimit] = useState(200);
  const [playbackRate, setPlaybackRate] = useState(1.0); // 无级调速：0.5x - 2.0x
  const [oralMessages, setOralMessages] = useState<any[]>([]);
  const [oralInput, setOralInput] = useState('');
  const [isOralLoading, setIsOralLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listenInput, setListenInput] = useState('');
  const [listenMaterial, setListenMaterial] = useState("I hear what you're saying about the Q3 budget, and I completely agree in principle. Let's circle back to this offline so we can take a more holistic view before committing to any hard deliverables.");
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [isListenLoading, setIsListenLoading] = useState(false);
  const [listenResult, setListenResult] = useState<{
    surfaceMeaning: string;
    hiddenSubtext: string;
    powerDynamics: string;
    keyJargons: Array<{ word: string; meaning: string }>;
  } | null>(null);

  const handleReview = async () => {
    if (!writingText || !writeIntent) return alert('请输入意图和内容');
    setIsReviewing(true);
    try {
      const result = await runEnglishWriteReview(writingText, writeIntent);
      setReviewResult(result);
    } catch (error) {
      alert('批阅失败，请检查 API 配置或网络');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOralSubmit = async () => {
    if (!oralInput.trim()) return;
    const userMsg = { role: 'user', content: oralInput };
    setOralMessages(prev => [...prev, userMsg]);
    setOralInput('');
    setIsOralLoading(true);

    try {
      const res = await sendOralChatMessage(userMsg.content, conversationId);
      if (res.conversation_id) setConversationId(res.conversation_id);

      let parsed: any = null;
      try {
        const cleanStr = String(res.answer || '').replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanStr);
      } catch (e) {
        parsed = { current_speaker: 'System', dialogue: res.answer || 'AI 返回为空' };
      }

      setOralMessages(prev => [...prev, { role: 'ai', parsed }]);
    } catch (error) {
      console.error(error);
      alert('沙盘推演请求失败，请检查网络或 HTTPS 证书配置。');
    } finally {
      setIsOralLoading(false);
    }
  };

  const handleListenAnalyze = async () => {
    setIsListenLoading(true);
    try {
      const result = await runEnglishListenEngine(listenMaterial);
      setListenResult(result);
    } catch (e) {
      alert('听辨解析失败，请检查网络或 API 配置。');
    } finally {
      setIsListenLoading(false);
    }
  };

  return (
    <ModuleWrapper
      title="英语战略 ｜ 跨文化信任构建"
      icon={<Globe className="w-8 h-8" strokeWidth={2.5} />}
      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。必须达成硬性通关标准方可解锁下行主题。"
    >
      {/* ── 子导航 Tab ── */}
      <div className="flex flex-wrap gap-2 mb-8 bg-[#f8f9fa] p-2 rounded-2xl border border-gray-100 w-max">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id as EnglishTab); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-widest uppercase transition-all ${
              activeTab === tab.id
                ? 'bg-[#202124] text-white shadow-md'
                : 'text-gray-500 hover:text-[#202124] hover:bg-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-[fadeIn_0.3s_ease-out]">

        {/* ═══════════════════════════════════════════════
            1. 进度总控 (Dashboard)
        ═══════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 战略阶段 + 主题锁 */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#FF5722] mb-3">战略阶段 (Stage)</span>
                <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setStage('0-6'); }}
                    className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '0-6' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}
                  >0-6个月: 政商务</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setStage('6-12'); }}
                    className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '6-12' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}
                  >6-12个月: 全场景</button>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 (Theme Gateway)</span>
                <div className="flex items-center gap-3">
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]"
                  >
                    <option>商务谈判：让步与施压 (Day 4/10)</option>
                    <option>危机公关：外媒答疑 (Day 1/10)</option>
                    <option>项目汇报：跨国董事会 (Day 1/10)</option>
                  </select>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMastered(!isMastered); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap ${isMastered ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">{isMastered ? '已通关' : '未达标'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 基础唤醒追踪 */}
            <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-6 flex items-center">
                <Clock className="w-5 h-5 mr-3" /> 基础唤醒追踪 (Foundation)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2">发音纠正 (10min/Day)</span>
                  <textarea
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
                    placeholder="记录今日纠正的商务重音词汇..."
                  />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2">核心语法复健 (8-10个核心点)</span>
                  <textarea
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
                    placeholder="如：被动语态/虚拟语气的商务应用..."
                  />
                </div>
              </div>
            </div>

            <MaterialUploader topicHint={`投喂提纯材料 - ${theme}`} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            2. 词汇矩阵 (Vocab Flashcard)
        ═══════════════════════════════════════════════ */}
        {activeTab === 'vocab' && (
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <span className="inline-block px-4 py-1.5 bg-[#FF5722]/10 text-[#FF5722] text-[10px] font-black uppercase tracking-widest rounded-full mb-4">
                  Theme Words // 主题核心词汇
                </span>
                <h2 className="text-5xl font-black text-[#202124] tracking-tight font-serif mb-2">Concession</h2>
                <p className="text-gray-400 font-bold tracking-widest text-lg">/kənˈseʃ.ən/</p>
                <div className="flex justify-center gap-3 mt-4">
                  <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded-lg">名词 Noun</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg">商务高频</span>
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-lg">政治语境</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100">
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">英英释义</h5>
                  <p className="text-sm text-gray-700 leading-relaxed">Something given up or allowed in order to reach an agreement, especially in a negotiation.</p>
                </div>
                <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100">
                  <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">商务例句</h5>
                  <p className="text-sm text-gray-700 leading-relaxed italic">"Making a small <strong className="text-[#FF5722]">concession</strong> on price can facilitate a faster payment cycle."</p>
                </div>
              </div>

              {/* 强制闭环造句区 */}
              <div className="bg-[#f8f9fa] border border-gray-200 rounded-3xl p-6">
                <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center mb-4">
                  <Zap className="w-4 h-4 mr-2 text-[#FF5722]" /> 强制闭环造句 (Forced Application)
                </label>
                <textarea
                  rows={3}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-white border-2 border-transparent focus:border-[#FF5722] rounded-2xl p-4 text-sm text-[#202124] outline-none resize-none shadow-inner transition-colors"
                  placeholder={`使用 "concession" 结合场景【${theme}】造句，AI 将实时评估语法与商务分寸...`}
                />
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-full mt-4 bg-[#202124] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#FF5722] transition-colors"
                >
                  提交评估并加入艾宾浩斯序列
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. 听辨与弦外之音盲听舱 (Listen) ================= */}
        {activeTab === 'listen' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px] h-[80vh]">
            {/* 左侧：音频控制与盲听输入 */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* 模块 A：情报原文与 AI 解析引擎 */}
              <div className="bg-[#202124] rounded-[2rem] p-8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden shrink-0">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF5722]/20 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">Daily Interception // 截获片段</h4>
                  <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-bold">高管会议盲听</span>
                </div>
                
                {/* 波形播放器 (增加了未接入的 Alert 提示) */}
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl mb-6 border border-white/10 relative z-10">
                  <button onClick={() => alert('🎵 真实 MP3 音频流将在下一步战役中接入，敬请期待...')} className="text-white hover:text-[#FF5722] transition-colors cursor-pointer" title="播放截获音频">
                    <PlayCircle className="w-10 h-10" />
                  </button>
                  <div className="flex-1 h-8 flex items-center gap-1 opacity-70">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="flex-1 bg-white rounded-full animate-pulse" style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                  <button className="text-white hover:text-gray-300 transition-colors cursor-pointer"><FastForward className="w-5 h-5" /></button>
                </div>

                <div className="relative z-10 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400">Target Transcript // 目标原文</span>
                    <button onClick={() => setIsTextVisible(!isTextVisible)} className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer">
                      {isTextVisible ? <><EyeOff className="w-3 h-3 mr-1"/> 隐藏 (开启盲听)</> : <><Eye className="w-3 h-3 mr-1"/> 显示文本</>}
                    </button>
                  </div>
                  <div className={`p-4 rounded-xl text-sm font-serif leading-relaxed transition-all duration-300 ${isTextVisible ? 'bg-white/10 text-gray-200 blur-none' : 'bg-black text-white/5 blur-[4px] select-none'}`}>
                    {listenMaterial}
                  </div>
                </div>

                {/* 【重点修改】：将请求 Dify 的按钮绑定在原文下方，逻辑绝对清晰 */}
                <button 
                  onClick={handleListenAnalyze}
                  disabled={isListenLoading || listenResult !== null}
                  className="w-full relative z-10 bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg"
                >
                  {isListenLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在解码潜台词...</> : (listenResult ? '✅ 潜台词已解码 (见右侧)' : '🧠 请求 Dify 侧写此段原文')}
                </button>
              </div>

              {/* 模块 B：影子键入区 (纯草稿本) */}
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">Shadowing Dictation // 盲打笔记区</label>
                  <span className="text-[9px] text-gray-400 font-bold">Local Draft</span>
                </div>
                <textarea 
                  rows={4}
                  value={listenInput}
                  onChange={(e) => setListenInput(e.target.value)}
                  className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-blue-200 rounded-xl p-4 text-sm text-[#202124] outline-none resize-none flex-1 mb-4 shadow-inner"
                  placeholder="边听音频，边将您捕捉到的职场黑话或复述文本键入此区域（此区域仅作自我比对草稿，不上传云端）..."
                />
                <button 
                  onClick={() => setIsTextVisible(true)}
                  className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer"
                >
                  👀 盲打完成，揭晓上方原文进行比对
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm overflow-y-auto">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-100 pb-4">Decrypted Intelligence // 情报解密</h4>

              {!listenResult ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-4 pt-10">
                  <Headphones className="w-16 h-16" />
                  <p className="text-xs font-bold tracking-widest uppercase">等待执行声纹解码</p>
                </div>
              ) : (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">1. Surface Meaning (伪装层)</h5>
                    <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 leading-relaxed border border-gray-100">
                      {listenResult.surfaceMeaning}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-2 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1" /> 2. Hidden Subtext (真实意图)
                    </h5>
                    <div className="bg-[#FF5722]/5 p-5 rounded-xl text-sm text-[#d84315] leading-relaxed border border-[#FF5722]/20 font-medium shadow-sm">
                      {listenResult.hiddenSubtext}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">3. Power Dynamics (权力场)</h5>
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 leading-relaxed border border-blue-100">
                      {listenResult.powerDynamics}
                    </div>
                  </div>

                  {listenResult.keyJargons.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">4. Extracted Jargons (截获黑话)</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {listenResult.keyJargons.map((item, idx) => (
                          <div key={idx} className="bg-[#202124] rounded-lg p-3 text-white shadow-md">
                            <div className="text-xs font-black text-[#FF5722] mb-1">{item.word}</div>
                            <div className="text-[10px] text-gray-300">{item.meaning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            4. 多角色谈判沙盘 (Oral War Room)
        ═══════════════════════════════════════════════ */}
        {activeTab === 'oral' && (
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm flex flex-col min-h-[600px] h-[80vh]">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100 shrink-0">
              <div>
                <h4 className="text-xl font-black text-[#202124] flex items-center">
                  <Mic className="w-6 h-6 mr-3 text-[#FF5722]" /> 跨文化谈判沙盘
                </h4>
                <p className="text-xs text-gray-500 font-bold tracking-widest mt-2 uppercase">多立场跟踪 / 联合与分化 / 破绽反击</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setOralMessages([]); setConversationId(null); }} className="text-[10px] text-gray-400 hover:text-[#202124] font-bold uppercase tracking-widest cursor-pointer">
                  ↻ 重置推演沙盘
                </button>
                <span className="text-[10px] bg-red-50 text-red-600 px-4 py-2 rounded-full font-black uppercase tracking-widest animate-pulse border border-red-100">
                  Hostile Environment Level 5
                </span>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-[2rem] p-6 mb-6 space-y-6 overflow-y-auto scroll-smooth">
              {oralMessages.length === 0 && (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm font-medium italic">
                  系统提示：输入您的开场白或应对策略，激活高管级别的交叉谈判...
                </div>
              )}

              {oralMessages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'ai' ? (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <span className="text-blue-800 font-black text-[9px] text-center leading-tight break-words px-1">{msg.parsed?.current_speaker || 'AI'}</span>
                      </div>
                      <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm text-sm text-[#202124] w-[80%] relative group">
                        {msg.parsed?.flaw_point && (
                          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button className="text-[10px] bg-red-100 text-red-600 px-3 py-1.5 rounded font-black uppercase tracking-widest shadow-sm border border-red-200" title={`隐藏意图: ${msg.parsed?.hidden_intent}`}>
                              🎯 识别破绽: {msg.parsed.flaw_point}
                            </button>
                          </div>
                        )}
                        <p className="font-serif leading-relaxed text-base">{msg.parsed?.dialogue}</p>
                        {msg.parsed?.evaluation && (
                          <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-[#FF5722] font-bold uppercase tracking-widest bg-[#FF5722]/5 p-2 rounded-lg">
                            系统侧写评分：{msg.parsed.evaluation}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 flex-row-reverse">
                      <div className="w-12 h-12 rounded-full bg-[#202124] border border-gray-700 flex items-center justify-center text-white font-black text-[10px] shrink-0 shadow-md">YOU</div>
                      <div className="bg-[#f8f9fa] p-5 rounded-2xl rounded-tr-none border border-gray-200 text-sm text-gray-700 w-[80%] font-medium">{msg.content}</div>
                    </div>
                  )}
                </div>
              ))}
              {isOralLoading && (
                <div className="text-xs text-gray-400 italic flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> 对方正在权衡回应...</div>
              )}
            </div>

            <div className="relative shrink-0">
              <textarea 
                rows={3}
                value={oralInput}
                onChange={e => setOralInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleOralSubmit(); } }}
                className="w-full bg-white p-5 pr-32 rounded-2xl border-2 border-blue-200 focus:border-[#FF5722] outline-none text-sm text-[#202124] resize-none shadow-inner transition-colors placeholder-gray-400"
                placeholder="【系统提示】：用英语输入反击话术 (按 Enter 发送，Shift+Enter 换行)..."
              />
              <div className="absolute right-4 bottom-4 flex gap-2">
                <button 
                  onClick={handleOralSubmit}
                  disabled={isOralLoading || !oralInput.trim()}
                  className="px-6 py-2.5 bg-[#202124] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex items-center cursor-pointer"
                >
                  {isOralLoading ? '回合推演中...' : '发送反击'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            5. 纵深书面 (Writing Review)
        ═══════════════════════════════════════════════ */}
        {activeTab === 'write' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 左：起草区 */}
            <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col">
              <h4 className="text-sm font-black text-[#202124] uppercase tracking-widest mb-6">Drafting Zone // 纵深书面起草</h4>
              
              <div className="flex flex-col gap-5 flex-1">
                {/* 意图输入 */}
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Step 1: Writing Intent // 行文意图
                  </label>
                  <input 
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#FF5722] font-bold outline-none focus:border-[#FF5722]/50 transition-colors shadow-sm"
                    placeholder="例如：解释信贷项目延期，并申请追加资源..."
                    value={writeIntent}
                    onChange={(e) => setWriteIntent(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* 正文输入 */}
                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-2">
                    Step 2: Draft Content // 原始草稿
                  </label>
                  <textarea
                    rows={12}
                    value={writingText}
                    onChange={(e) => setWritingText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 rounded-2xl p-6 text-sm text-[#202124] outline-none resize-none leading-relaxed flex-1 placeholder-gray-400 shadow-inner"
                    placeholder="在此粘贴或撰写您的英文草稿..."
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={(e) => { e.stopPropagation(); handleReview(); }}
                  disabled={isReviewing}
                  className="bg-[#202124] text-white px-10 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-all disabled:opacity-50 shadow-lg"
                >
                  {isReviewing ? 'Dify 正在审阅...' : '提交三维批阅'}
                </button>
              </div>
            </div>

            {/* 右侧批阅展示区 */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <ReviewCard title="L1 语法与措辞" content={reviewResult?.L1} isLoading={isReviewing} />
              <ReviewCard title="L2 商务分寸" content={reviewResult?.L2} isLoading={isReviewing} color="text-[#d84315]" />
              <ReviewCard 
                title="L3 战略站位" 
                content={reviewResult?.L3} 
                isLoading={isReviewing} 
                isDark 
                optimized={reviewResult?.optimized_version} 
              />
            </div>
          </div>
        )}

      </div>
    </ModuleWrapper>
  );
}
