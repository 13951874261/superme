import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, Target, TimerReset, Volume2, Zap } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import PronunciationTrainer from './PronunciationTrainer';
import GrammarPolishTrainer from './GrammarPolishTrainer';
import { useEnglishContext } from './english/context/EnglishContext';
import { runEnglishWakeupRoutine } from '../../services/difyAPI';
import { upsertTrainingSession, getThemeStayStats, getTrainingSessionByDate, ThemeStayStats } from '../../services/trainingAPI';

interface WakeupWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

interface WakeupResult {
  theme: string;
  vocab: WakeupWord[];
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}

function formatSeconds(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DailyWakeupModule() {
  const { pronunciationNotes, setPronunciationNotes, grammarNotes, setGrammarNotes } = useEnglishContext();
  const [theme, setTheme] = useState('银团贷款');
  const [result, setResult] = useState<WakeupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>('等待开始今日唤醒');
  const [isSuggestionExpanded, setIsSuggestionExpanded] = useState(false);

  // 新增接口数据状态
  const [stayStats, setStayStats] = useState<ThemeStayStats | null>(null);
  const [todaySession, setTodaySession] = useState<any | null>(null);
  
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    setRunning(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    startRef.current = Date.now();
    setSeconds(0);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      if (!startRef.current) return;
      setSeconds(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    }, 1000);
  };

  useEffect(() => () => stopTimer(), []);

  // 异步拉取真实接口数据
  const loadStatsAndSession = async (currentTheme: string) => {
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const [stats, sessionDetail] = await Promise.all([
        getThemeStayStats(currentTheme).catch(() => null),
        getTrainingSessionByDate({ trainingDate: todayStr }).catch(() => null)
      ]);
      
      if (stats) setStayStats(stats);
      if (sessionDetail) setTodaySession(sessionDetail.session);
    } catch (error) {
      console.error('加载打卡状态与主题统计失败:', error);
    }
  };

  // 防抖自动拉取
  useEffect(() => {
    const timer = setTimeout(() => {
      loadStatsAndSession(theme);
    }, 600);
    return () => clearTimeout(timer);
  }, [theme]);

  const handleStart = async () => {
    setLoading(true);
    setNotice('正在生成今日唤醒内容...');
    try {
      // 触发一次数据更新
      loadStatsAndSession(theme);
      const data = await runEnglishWakeupRoutine(theme);
      setResult(data);
      setNotice(`已生成主题：${data.theme || theme}`);
      startTimer();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!result) {
      setNotice('请先开始今日唤醒');
      return;
    }
    setCheckInLoading(true);
    try {
      const today = new Date();
      const trainingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await upsertTrainingSession({
        trainingDate,
        totalMinutes: Math.max(1, Math.ceil(seconds / 60)),
        listenMinutes: 0,
        logicMinutes: 0,
      });
      setNotice(`打卡成功，今日练习时长 ${formatSeconds(seconds)}`);
      stopTimer();
      // 打卡成功重新加载数据
      await loadStatsAndSession(theme);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '打卡失败');
    } finally {
      setCheckInLoading(false);
    }
  };

  const completedCount = useMemo(() => result?.vocab?.length || 0, [result]);

  // 动态徽章
  const stickerBadge = useMemo(() => {
    const isCompleted = todaySession && todaySession.totalMinutes > 0;
    const days = stayStats?.stayDays || 0;
    
    if (isCompleted) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-fade-in relative z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          ✨ 唤醒打卡已完成
        </div>
      );
    }
    
    if (running) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse relative z-20">
          <Clock3 className="w-3.5 h-3.5" />
          ⏱️ 唤醒打卡计时中
        </div>
      );
    }
    
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20 relative z-20">
        <span>🔥 主题研习第 {days} 天</span>
      </div>
    );
  }, [todaySession, stayStats, running]);

  return (
    <ModuleWrapper 
      title="每日唤醒 ｜ 发音与语法闭环"
      icon={<TimerReset className="w-8 h-8" strokeWidth={2.5} />}
      description="根据主题生成发音注意点与关联语法点，配合 TTS 朗读和训练时长打卡，形成每日唤醒闭环。"
      badge={stickerBadge}
      compact
    >
      <style>{`
        @keyframes border-glow {
          0%, 100% { border-color: rgba(245, 158, 11, 0.15); box-shadow: 0 10px 30px rgba(245, 158, 11, 0.02); }
          50% { border-color: rgba(245, 158, 11, 0.45); box-shadow: 0 10px 35px rgba(245, 158, 11, 0.12); }
        }
        .animate-glow-pulse {
          animation: border-glow 3s infinite ease-in-out;
        }
      `}</style>

      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100/80 shadow-[0_12px_35px_rgba(0,0,0,0.02)] flex flex-col gap-6 h-auto animate-fade-in">
        
        {/* 场景化沉浸状态卡片 (Awakening Guidance Card) */}
        <div className={`w-full rounded-2xl p-4 md:p-5 text-white relative overflow-hidden transition-all duration-700 ${
          running 
            ? 'bg-[#1b1c1e] border border-amber-500/30 scale-[1.002] ring-1 ring-amber-500/10 animate-glow-pulse' 
            : 'bg-[#202124] border border-white/5 shadow-md'
        }`}>
          {/* CSS 网格背景效果 */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          
          {/* 渐变流光 */}
          <div className={`absolute -right-20 -bottom-20 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
            running 
              ? 'bg-amber-500/10 animate-pulse' 
              : 'bg-emerald-500/5'
          }`} />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* 左侧及中间信息 */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-gray-300 border border-white/5">
                  AWAKENING STATUS
                </span>
                <span className={`h-2 w-2 rounded-full ${running ? 'bg-amber-500 animate-ping' : todaySession && todaySession.totalMinutes > 0 ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                <span className="text-xs font-bold text-gray-400">
                  {running ? '唤醒计时中' : todaySession && todaySession.totalMinutes > 0 ? '今日已完成唤醒' : '等待开启唤醒'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* 左侧：聚焦主题 */}
                <div className="md:col-span-4 space-y-1">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">当前聚焦主题</div>
                  <div className="text-base font-black text-white flex flex-wrap items-center gap-2">
                    <span className="text-amber-400">{theme}</span>
                    <span className="text-xs font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">研习第 {stayStats?.stayDays || 0} 天</span>
                  </div>
                </div>
                
                {/* 中间：今日建议与薄弱点 */}
                <div className="md:col-span-8 space-y-3 border-t md:border-t-0 md:border-l border-white/5 md:pl-4 pt-3 md:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">今日唤醒建议</div>
                    {stayStats?.todaySuggestion && stayStats.todaySuggestion.length > 150 && (
                      <button
                        onClick={() => setIsSuggestionExpanded(!isSuggestionExpanded)}
                        className="text-[10px] font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors bg-amber-500/10 px-2 py-0.5 rounded-full"
                      >
                        {isSuggestionExpanded ? '收起详情' : '展开全文'}
                      </button>
                    )}
                  </div>

                  <div className="relative group">
                    <div className={`text-xs md:text-sm text-gray-300 leading-relaxed font-medium transition-all duration-300 ${!isSuggestionExpanded && stayStats?.todaySuggestion && stayStats.todaySuggestion.length > 150 ? 'line-clamp-4' : ''}`}>
                      {stayStats?.todaySuggestion ? (
                        <>
                          {/* 直接在同一层级渲染文本以保证 line-clamp 生效 */}
                          {stayStats.todaySuggestion.split(/(?=评分: \d+分)|(?=\[[\d:]+\] 练习:)/).map((segment, idx) => {
                            // 检测是否是日志数据段
                            const isLog = segment.includes('评分:') || segment.includes('练习:');
                            if (isLog) {
                              return (
                                <span key={idx} className="inline-block bg-white/5 border border-white/10 rounded-md px-2 py-1 my-1 mr-2 text-[10px] text-gray-400 font-mono align-middle">
                                  {segment.trim()}
                                </span>
                              );
                            }
                            // 如果包含重点纠正，则加粗高亮
                            if (segment.includes('重点纠正')) {
                               const parts = segment.split('重点纠正');
                               return (
                                 <span key={idx}>
                                   {parts[0]}<span className="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded mr-1">重点纠正</span>{parts[1]}
                                 </span>
                               )
                            }
                            return <span key={idx}>{segment}</span>;
                          })}
                        </>
                      ) : (
                        '输入您要训练的业务主题（例如：银团贷款），系统将载入发音重点与建议。'
                      )}
                    </div>

                    {/* 渐变遮罩 (仅在未展开且有长文本时显示) */}
                    {!isSuggestionExpanded && stayStats?.todaySuggestion && stayStats.todaySuggestion.length > 150 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#202124] to-transparent pointer-events-none"></div>
                    )}
                  </div>

                  {stayStats?.weakPoints && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 pt-2 border-t border-white/5 text-xs text-gray-400">
                      {stayStats.weakPoints.pronunciation && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>发音弱点：<strong className="text-amber-400 font-bold">{stayStats.weakPoints.pronunciation}</strong></span>
                        </div>
                      )}
                      {stayStats.weakPoints.grammar && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                          <span>语法弱点：<strong className="text-blue-400 font-bold">{stayStats.weakPoints.grammar}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 右侧：状态面板 */}
            <div className="flex lg:flex-col items-start lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-4 shrink-0 gap-4">
              <div className="text-left lg:text-right">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">今日打卡状态</div>
                <div className="text-sm font-black text-white mt-1 flex items-center gap-2 lg:justify-end">
                  {running ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      计时中 ({formatSeconds(seconds)})
                    </span>
                  ) : todaySession && todaySession.totalMinutes > 0 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      ✅ 已打卡 ({todaySession.totalMinutes} 分钟)
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1">
                      💤 未打卡
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-left lg:text-right">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">系统研习数据</div>
                <div className="text-xs font-bold text-gray-300 mt-0.5">
                  累计停留 {stayStats?.stayDays || 0} 天
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 顶部场景大卡片 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl p-6 lg:p-8 border border-gray-100/50 shadow-sm relative">
          {/* 左侧 8 栏：主标题、输入框及控制台、状态提示 */}
          <div className="md:col-span-8 space-y-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-2">Daily Wakeup // 基础唤醒</div>
              <h3 className="text-2xl font-black text-[#202124]">发音与语法唤醒机制</h3>
              <p className="text-sm text-gray-500 mt-2">主题驱动生成 10 个高频词 + 1 个关联语法点，并记录练习时长。</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#FF5722] focus:ring-4 focus:ring-[#FF5722]/10 transition-all duration-300"
                placeholder="输入主题，例如：银团贷款"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="px-6 py-3 rounded-2xl bg-[#202124] text-white font-black text-xs tracking-widest uppercase hover:bg-[#FF5722] transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {loading ? '唤醒生成中' : '开始今日唤醒'}
                </button>
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading || !result}
                  className="px-6 py-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 text-emerald-700 font-black text-xs tracking-widest uppercase hover:bg-emerald-50 transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {checkInLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  完成打卡
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4 text-sm text-gray-600 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {notice}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">已生成 {completedCount} 个词</span>
            </div>
          </div>

          {/* 右侧 4 栏：专注时长环形进度 */}
          <div className="md:col-span-4 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
            <div className="relative flex flex-col items-center justify-center w-28 h-28 rounded-full bg-gray-50 border border-gray-100 shadow-inner group">
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="46" stroke="#f3f4f6" strokeWidth="6" fill="transparent" />
                <circle cx="56" cy="56" r="46" stroke="#FF5722" strokeWidth="6" fill="transparent" 
                        strokeDasharray={289} strokeDashoffset={289 - (seconds % 60) * 4.81}
                        className="transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(255,87,34,0.15)]" />
              </svg>
              <span className="text-xl font-bold font-mono tabular-nums text-[#202124] z-10">
                {formatSeconds(seconds)}
              </span>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider z-10 mt-1">Focus Time</span>
            </div>
            
            {/* 简短说明区 */}
            <div className="flex flex-col items-start gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#FF5722]"></div>
                <span>场景高频词汇实时生成</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#FF5722]"></div>
                <span>标准发音示范与影子跟读</span>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="w-5 h-5 text-[#FF5722]" />
                <h4 className="text-sm font-black uppercase tracking-widest text-[#202124]">10 个高频词发音注意点</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.vocab.map((item) => (
                  <div
                    key={item.word}
                    className="text-left rounded-2xl border border-gray-100 p-4 bg-[#f8f9fa] hover:border-[#FF5722] hover:bg-white transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-black text-[#202124]">{item.word}</div>
                          <SpeakButton text={item.word} title={`播放 ${item.word}`} />
                        </div>
                        <div className="text-sm text-blue-600 font-mono mt-1">{item.ipa}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">{item.meaning_zh}</div>
                    <div className="mt-3 rounded-xl bg-orange-50 text-orange-700 text-xs font-medium p-3 leading-relaxed">
                      {item.pronunciation_note}
                    </div>
                    <div className="mt-3 text-xs text-gray-500 italic leading-relaxed flex items-start justify-between gap-3">
                      <span>{item.example}</span>
                      <SpeakButton text={item.example} title="播放例句" className="flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#202124] rounded-2xl border border-gray-900 p-5 lg:p-6 text-white shadow-sm flex flex-col gap-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TimerReset className="w-5 h-5 text-[#FF5722]" />
                  <h4 className="text-sm font-black uppercase tracking-widest">关联语法点</h4>
                </div>
                <div className="text-[11px] text-gray-400 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex flex-col gap-1.5 leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-[#FF5722] mt-1.5 shrink-0"></div>
                    <div><span className="text-gray-300 font-bold">作用：</span>提供造句底层骨架，完成从单词发音到严谨商务长句的升维闭环。</div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-[#FF5722] mt-1.5 shrink-0"></div>
                    <div><span className="text-gray-300 font-bold">用法：</span>结合上方高频词，对照正误示例进行场景化跟读与造句训练。</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-2">
                {/* 左侧：语法核心与释义 */}
                <div className="lg:col-span-5 flex flex-col">
                  <h5 className="text-2xl lg:text-3xl font-black mb-4">{result.grammar.point}</h5>
                  <p className="text-gray-300 text-sm lg:text-base leading-relaxed">{result.grammar.explanation}</p>
                </div>
                
                {/* 右侧：实战例句对错阵列 */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  {result.grammar.examples.map((ex, idx) => (
                    <div key={idx} className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Correct
                          </div>
                          <SpeakButton text={ex.correct} title="播放正确商务例句" />
                        </div>
                        <div className="text-sm text-white font-medium leading-relaxed">{ex.correct}</div>
                      </div>
                      
                      <div className="hidden md:block w-px bg-white/10"></div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Incorrect
                          </div>
                          <SpeakButton text={ex.incorrect} title="播放常见错误发音以作比对" />
                        </div>
                        <div className="text-sm text-gray-400 leading-relaxed">{ex.incorrect}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 基础唤醒追踪 (Foundation) - 从英语战略模块迁移至此 */}
        <div className="bg-[#202124] rounded-3xl p-5 md:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
          <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-6 flex items-center">
            <Clock3 className="w-5 h-5 mr-3" /> 基础唤醒追踪 (Foundation)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">发音纠正 (10min/Day)</span>
              <div className="flex-1 min-h-0">
                <PronunciationTrainer
                  initialNotes={pronunciationNotes}
                  onNotesChange={setPronunciationNotes}
                  userId="default-user"
                />
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">核心语法复健 (8-10个核心点)</span>
              <div className="flex-1 min-h-0">
                <GrammarPolishTrainer
                  initialNotes={grammarNotes}
                  onNotesChange={setGrammarNotes}
                  userId="default-user"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </ModuleWrapper>
  );
}
