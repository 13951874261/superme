import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Mic, Volume2, Target, CheckCircle2, Zap, PenTool, BookOpen, Clock, AlertTriangle, Loader2, PlayCircle, FastForward, Eye, EyeOff, Headphones } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import MaterialUploader from '../MaterialUploader';
import SpeakButton, { speakEnglish } from '../SpeakButton';
import OralWarRoom from './OralWarRoom';
import { getDueVocabulary, runEnglishWriteReview, runEnglishListenEngine, runEnglishSentenceEvaluation } from '../../services/difyAPI';
import { submitReview } from '../../services/vocabAPI';

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
        <div className="flex items-center justify-between gap-3 mb-3">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722]">
            AI 高管级示范文本 (Optimized Version)
          </h5>
          <SpeakButton text={optimized} title="播放 AI 高管级示范文本" />
        </div>
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
  const [playbackRate, setPlaybackRate] = useState(1.0);
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

  const [dueWords, setDueWords] = useState<any[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [sentenceInput, setSentenceInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ feedback: string; quality: number } | null>(null);
  const [loadingDueWords, setLoadingDueWords] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [noticeAnchor, setNoticeAnchor] = useState<'review' | 'oral' | 'listen' | 'eval' | null>(null);

  const showNotice = (anchor: 'review' | 'oral' | 'listen' | 'eval', text: string, tone: 'success' | 'error' | 'info') => {
    setNoticeAnchor(anchor);
    setInlineNotice({ text, tone });
  };

  useEffect(() => {
    if (activeTab !== 'vocab') return;
    setLoadingDueWords(true);
    getDueVocabulary()
      .then((data) => {
        setDueWords(data);
        setCurrentWordIdx(0);
        setSentenceInput('');
        setEvalResult(null);
      })
      .catch(() => setDueWords([]))
      .finally(() => setLoadingDueWords(false));
  }, [activeTab]);

  const currentWord = useMemo(() => dueWords[currentWordIdx], [dueWords, currentWordIdx]);
  const currentWordExample = useMemo(() => (
    currentWord?.payload?.examples?.[0]
    || currentWord?.payload?.related_sentences?.[0]
    || currentWord?.payload?.related_phrases?.[0]
    || ''
  ), [currentWord]);

  const handleReview = async () => {
    if (!writingText || !writeIntent) {
      showNotice('review', '请输入意图和内容', 'error');
      return;
    }
    setIsReviewing(true);
    setInlineNotice(null);
    setNoticeAnchor('review');
    try {
      const result = await runEnglishWriteReview(writingText, writeIntent);
      setReviewResult(result);
      showNotice('review', '批阅完成', 'success');
    } catch (error) {
      showNotice('review', '批阅失败，请检查 API 配置或网络', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleListenAnalyze = async () => {
    setIsListenLoading(true);
    try {
      const result = await runEnglishListenEngine(listenMaterial);
      setListenResult(result);
    } catch (e) {
      showNotice('listen', '听辨解析失败，请检查网络或 API 配置。', 'error');
    } finally {
      setIsListenLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!currentWord || !sentenceInput.trim()) return;
    setIsEvaluating(true);
    try {
      const result = await runEnglishSentenceEvaluation(currentWord.word, sentenceInput);
      const quality = Math.max(0, Math.min(5, Math.round(Number(result.score ?? 4))));
      setEvalResult({ feedback: result.feedback, quality });
      await submitReview(currentWord.id, quality);
      window.dispatchEvent(new Event('vocab-updated'));
      showNotice('eval', '评估完成，已写入复习记录', 'success');
    } catch (err: any) {
      showNotice('eval', `评估失败: ${err.message}`, 'error');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <ModuleWrapper
      title="英语战略 ｜ 跨文化信任构建"
      icon={<Globe className="w-8 h-8" strokeWidth={2.5} />}
      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。必须达成硬性通关标准方可解锁下行主题。"
    >
      <div className="flex flex-wrap gap-2 mb-8 bg-[#f8f9fa] p-2 rounded-2xl border border-gray-100 w-max">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id as EnglishTab); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-widest uppercase transition-all ${
              activeTab === tab.id ? 'bg-[#202124] text-white shadow-md' : 'text-gray-500 hover:text-[#202124] hover:bg-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-[fadeIn_0.3s_ease-out]">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#FF5722] mb-3">战略阶段 (Stage)</span>
                <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                  <button onClick={(e) => { e.stopPropagation(); setStage('0-6'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '0-6' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>0-6个月: 政商务</button>
                  <button onClick={(e) => { e.stopPropagation(); setStage('6-12'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '6-12' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>6-12个月: 全场景</button>
                </div>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 (Theme Gateway)</span>
                <div className="flex items-center gap-3">
                  <select value={theme} onChange={(e) => setTheme(e.target.value)} onClick={(e) => e.stopPropagation()} className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]">
                    <option>商务谈判：让步与施压 (Day 4/10)</option>
                    <option>危机公关：外媒答疑 (Day 1/10)</option>
                    <option>项目汇报：跨国董事会 (Day 1/10)</option>
                  </select>
                  <button onClick={(e) => { e.stopPropagation(); setIsMastered(!isMastered); }} className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap ${isMastered ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">{isMastered ? '已通关' : '未达标'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-6 flex items-center">
                <Clock className="w-5 h-5 mr-3" /> 基础唤醒追踪 (Foundation)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2">发音纠正 (10min/Day)</span>
                  <textarea rows={2} onClick={(e) => e.stopPropagation()} className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none" placeholder="记录今日纠正的商务重音词汇..." />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2">核心语法复健 (8-10个核心点)</span>
                  <textarea rows={2} onClick={(e) => e.stopPropagation()} className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none" placeholder="如：被动语态/虚拟语气的商务应用..." />
                </div>
              </div>
            </div>

            <div className="relative">
              {inlineNotice && noticeAnchor === 'review' && (
                <div className={`absolute left-1/2 -translate-x-1/2 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                  {inlineNotice.text}
                </div>
              )}
              <MaterialUploader topicHint={theme} onExtractionSuccess={() => setActiveTab('vocab')} />
            </div>
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
            {loadingDueWords ? (
              <div className="text-gray-400 text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 拉取今日待复习生词中...</div>
            ) : !currentWord ? (
              <div className="w-full max-w-2xl text-center py-24">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-[#202124]">今日词汇已清空</h3>
                <p className="text-sm text-gray-500 mt-2">请到“进度总控”执行提纯，或休息一下。</p>
              </div>
            ) : (
              <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 bg-[#FF5722]/10 text-[#FF5722] text-[10px] font-black uppercase tracking-widest rounded-full mb-4">Theme Words // 主题核心词汇</span>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <h2 className="text-5xl font-black text-[#202124] tracking-tight font-serif">{currentWord.word}</h2>
                    <SpeakButton text={currentWord.word} title={`播放 ${currentWord.word}`} className="w-11 h-11" iconClassName="w-5 h-5" />
                  </div>
                  <p className="text-gray-400 font-bold tracking-widest text-lg">{currentWord.payload?.phonetic || currentWord.payload?.definition_en || ''}</p>
                  {inlineNotice && noticeAnchor === 'eval' && (
                    <div className={`mx-auto mt-4 inline-flex rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                      {inlineNotice.text}
                    </div>
                  )}
                  <div className="flex justify-center gap-3 mt-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded-lg">{currentWord.payload?.partOfSpeech || currentWord.dict_type || '词条'}</span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg">商务高频</span>
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-lg">{theme}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">英英释义</h5>
                    <p className="text-sm text-gray-700 leading-relaxed">{currentWord.payload?.definition_en || currentWord.payload?.meaning || '暂无释义'}</p>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">商务例句</h5>
                      <SpeakButton text={currentWordExample} title="播放商务例句" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed italic">{currentWordExample ? `"${currentWordExample}"` : '暂无例句'}</p>
                  </div>
                </div>

                <div className={`border-2 rounded-3xl p-6 transition-all ${evalResult ? (evalResult.quality >= 3 ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30') : 'border-gray-100 bg-[#f8f9fa]'}`}>
                  <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center mb-4">
                    <Zap className="w-4 h-4 mr-2 text-[#FF5722]" /> 强制闭环造句 (Forced Application)
                  </label>
                  <textarea
                    rows={3}
                    value={sentenceInput}
                    onChange={(e) => setSentenceInput(e.target.value)}
                    disabled={isEvaluating || !!evalResult}
                    className="w-full bg-white border-2 border-transparent focus:border-[#FF5722] rounded-2xl p-4 text-sm text-[#202124] outline-none resize-none shadow-inner transition-colors disabled:bg-gray-50"
                    placeholder={`使用 "${currentWord.word}" 结合场景【${theme}】造句，AI 将实时评估语法与商务分寸...`}
                  />

                  {evalResult && (
                    <div className="mt-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm animate-[fadeIn_0.3s_ease-out]">
                      <h5 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${evalResult.quality >= 3 ? 'text-emerald-500' : 'text-red-500'}`}>
                        AI 判卷结果 (SM-2 权重: {evalResult.quality}/5)
                      </h5>
                      <p className="text-sm text-gray-700 leading-relaxed">{evalResult.feedback}</p>
                    </div>
                  )}

                  {!evalResult ? (
                    <button
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !sentenceInput.trim()}
                      className="w-full mt-4 bg-[#202124] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex justify-center items-center"
                    >
                      {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : '提交评估并推入记忆曲线'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEvalResult(null);
                        setSentenceInput('');
                        setCurrentWordIdx((p) => p + 1);
                      }}
                      className="w-full mt-4 bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#E64A19] transition-colors"
                    >
                      下一词 (Next Target) ➔
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'listen' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px] h-[80vh]">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-[#202124] rounded-[2rem] p-8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden shrink-0">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF5722]/20 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">Daily Interception // 截获片段</h4>
                  <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-bold">高管会议盲听</span>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl mb-6 border border-white/10 relative z-10">
                  <button onClick={() => speakEnglish(listenMaterial, 0.9)} className="text-white hover:text-[#FF5722] transition-colors cursor-pointer" title="播放截获音频">
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
                  <div className="flex justify-between items-center mb-3 gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400">Target Transcript // 目标原文</span>
                    <div className="flex items-center gap-2">
                      <SpeakButton text={listenMaterial} title="播放目标原文" className="bg-white/10 text-white hover:bg-[#FF5722]" />
                      <button onClick={() => setIsTextVisible(!isTextVisible)} className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer">
                        {isTextVisible ? <><EyeOff className="w-3 h-3 mr-1"/> 隐藏 (开启盲听)</> : <><Eye className="w-3 h-3 mr-1"/> 显示文本</>}
                      </button>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl text-sm font-serif leading-relaxed transition-all duration-300 ${isTextVisible ? 'bg-white/10 text-gray-200 blur-none' : 'bg-black text-white/5 blur-[4px] select-none'}`}>
                    {listenMaterial}
                  </div>
                </div>
                <div className="relative">
                  {inlineNotice && noticeAnchor === 'listen' && (
                    <div className={`absolute left-1/2 -translate-x-1/2 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                      {inlineNotice.text}
                    </div>
                  )}
                  <button 
                    onClick={handleListenAnalyze}
                    disabled={isListenLoading || listenResult !== null}
                    className="w-full relative z-10 bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg"
                  >
                    {isListenLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在解码潜台词...</> : (listenResult ? '✅ 潜台词已解码 (见右侧)' : '🧠 请求 Dify 侧写此段原文')}
                  </button>
                </div>
              </div>

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
                    <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 leading-relaxed border border-gray-100">{listenResult.surfaceMeaning}</div>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-1" /> 2. Hidden Subtext (真实意图)</h5>
                    <div className="bg-[#FF5722]/5 p-5 rounded-xl text-sm text-[#d84315] leading-relaxed border border-[#FF5722]/20 font-medium shadow-sm">{listenResult.hiddenSubtext}</div>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">3. Power Dynamics (权力场)</h5>
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 leading-relaxed border border-blue-100">{listenResult.powerDynamics}</div>
                  </div>
                  {listenResult.keyJargons.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">4. Extracted Jargons (截获黑话)</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {listenResult.keyJargons.map((item, idx) => (
                          <div key={idx} className="bg-[#202124] rounded-lg p-3 text-white shadow-md">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="text-xs font-black text-[#FF5722]">{item.word}</div>
                              <SpeakButton text={item.word} title={`播放 ${item.word}`} className="w-7 h-7 bg-white/10 text-white hover:bg-[#FF5722]" iconClassName="w-3.5 h-3.5" />
                            </div>
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

        {activeTab === 'oral' && <OralWarRoom embedded />}

        {activeTab === 'write' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm flex flex-col">
              <h4 className="text-sm font-black text-[#202124] uppercase tracking-widest mb-6">Drafting Zone // 纵深书面起草</h4>
              <div className="flex flex-col gap-5 flex-1">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Step 1: Writing Intent // 行文意图</label>
                  <input className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#FF5722] font-bold outline-none focus:border-[#FF5722]/50 transition-colors shadow-sm" placeholder="例如：解释信贷项目延期，并申请追加资源..." value={writeIntent} onChange={(e) => setWriteIntent(e.target.value)} onClick={(e) => e.stopPropagation()} />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-2">Step 2: Draft Content // 原始草稿</label>
                  <textarea rows={12} value={writingText} onChange={(e) => setWritingText(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 rounded-2xl p-6 text-sm text-[#202124] outline-none resize-none leading-relaxed flex-1 placeholder-gray-400 shadow-inner" placeholder="在此粘贴或撰写您的英文草稿..." />
                </div>
              </div>
              <div className="relative flex justify-end mt-6">
                {inlineNotice && noticeAnchor === 'review' && (
                  <div className={`absolute right-0 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                    {inlineNotice.text}
                  </div>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleReview(); }} disabled={isReviewing} className="bg-[#202124] text-white px-10 py-4 rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-all disabled:opacity-50 shadow-lg">
                  {isReviewing ? 'Dify 正在审阅...' : '提交三维批阅'}
                </button>
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col gap-4">
              <ReviewCard title="L1 语法与措辞" content={reviewResult?.L1} isLoading={isReviewing} />
              <ReviewCard title="L2 商务分寸" content={reviewResult?.L2} isLoading={isReviewing} color="text-[#d84315]" />
              <ReviewCard title="L3 战略站位" content={reviewResult?.L3} isLoading={isReviewing} isDark optimized={reviewResult?.optimized_version} />
            </div>
          </div>
        )}
      </div>
    </ModuleWrapper>
  );
}
