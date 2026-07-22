import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, TimerReset, Volume2, Zap } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import PronunciationTrainer from './PronunciationTrainer';
import GrammarPolishTrainer from './GrammarPolishTrainer';
import { useEnglishContext } from './english/context/EnglishContext';
import { runEnglishWakeupRoutine } from '../../services/difyAPI';
import { upsertTrainingSession } from '../../services/trainingAPI';
import { getAppUserId } from '../../utils/profileHelper';

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
  const {
    pronunciationNotes,
    setPronunciationNotes,
    grammarNotes,
    setGrammarNotes,
    theme,
    setTheme,
    stayStats,
    todaySession,
    refreshStayStats,
    refreshTodaySession,
  } = useEnglishContext();
  const [isOpen, setIsOpen] = useState(true);
  const [result, setResult] = useState<WakeupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>('等待开始今日唤醒');
  
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

  const handleStart = async () => {
    setLoading(true);
    setNotice('正在生成今日唤醒内容...');
    try {
      void refreshStayStats(true);
      void refreshTodaySession();
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
      await Promise.all([refreshStayStats(true), refreshTodaySession()]);
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
          唤醒打卡已完成
        </div>
      );
    }
    
    if (running) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse relative z-20">
          <Clock3 className="w-3.5 h-3.5" />
          唤醒打卡计时中
        </div>
      );
    }
    
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FF5722]/10 text-[#FF5722] border border-[#FF5722]/20 relative z-20">
        <span>主题研习第 {days} 天</span>
      </div>
    );
  }, [todaySession, stayStats, running]);

  const checkInLabel = running
    ? `计时中 (${formatSeconds(seconds)})`
    : todaySession && todaySession.totalMinutes > 0
      ? `已打卡 (${todaySession.totalMinutes} 分钟)`
      : '未打卡';

  return (
    <ModuleWrapper 
      isOpen={isOpen}
      onToggleCollapse={() => setIsOpen(prev => !prev)}
      title="每日唤醒 ｜ 发音与语法闭环"
      icon={<TimerReset className="w-8 h-8" strokeWidth={2.5} />}
      description="主题生成发音注意点与关联语法点，配合 TTS 与时长打卡形成闭环。"
      badge={stickerBadge}
      compact
    >
      <style>{`
        @keyframes border-glow {
          0%, 100% { border-color: rgba(245, 158, 11, 0.15); box-shadow: 0 8px 20px rgba(245, 158, 11, 0.02); }
          50% { border-color: rgba(245, 158, 11, 0.45); box-shadow: 0 8px 24px rgba(245, 158, 11, 0.1); }
        }
        .animate-glow-pulse {
          animation: border-glow 3s infinite ease-in-out;
        }
      `}</style>

      <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-100/80 shadow-[0_8px_24px_rgba(0,0,0,0.02)] flex flex-col gap-3 h-auto animate-fade-in">

        {/* 合并工作台：状态 + 操作 + 计时 */}
        <div className={`w-full rounded-xl text-white relative overflow-hidden transition-all duration-500 ${
          running
            ? 'bg-[#1b1c1e] border border-amber-500/30 ring-1 ring-amber-500/10 animate-glow-pulse'
            : 'bg-[#202124] border border-white/5'
        }`}>
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
          <div className={`absolute -right-16 -bottom-16 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
            running ? 'bg-amber-500/10' : 'bg-emerald-500/5'
          }`} />

          <div className="relative z-10 p-3 md:p-3.5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-white/10 text-gray-300 border border-white/5">
                    Status
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-amber-500 animate-ping' : todaySession && todaySession.totalMinutes > 0 ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                  <span className="text-xs font-bold text-gray-400">
                    {running ? '唤醒计时中' : todaySession && todaySession.totalMinutes > 0 ? '今日已完成' : '等待开启'}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">·</span>
                  <span className={`text-[11px] font-bold ${running ? 'text-amber-400' : todaySession && todaySession.totalMinutes > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {checkInLabel}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">· 累计 {stayStats?.stayDays || 0} 天</span>
                </div>
                <div className="text-sm font-black text-white truncate">
                  <span className="text-gray-500 font-bold text-[11px] uppercase tracking-wider mr-2">主题</span>
                  <span className="text-amber-400">{theme}</span>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center w-16 h-16 shrink-0 rounded-full bg-white/5 border border-white/10">
                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 64 64" aria-hidden>
                  <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="transparent" />
                  <circle
                    cx="32" cy="32" r="26" stroke="#FF5722" strokeWidth="4" fill="transparent"
                    strokeDasharray={163.4}
                    strokeDashoffset={163.4 - (seconds % 60) * (163.4 / 60)}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="text-sm font-bold font-mono tabular-nums z-10">{formatSeconds(seconds)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="flex-1 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/20 transition-all placeholder:text-gray-500"
                placeholder="输入主题，例如：银团贷款"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-white text-[#202124] font-black text-xs tracking-wide hover:bg-[#FF5722] hover:text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {loading ? '生成中' : '开始今日唤醒'}
                </button>
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading || !result}
                  className="px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-black text-xs tracking-wide hover:bg-emerald-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {checkInLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  完成打卡
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-gray-400 border-t border-white/5 pt-2.5">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="truncate">{notice}</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 shrink-0">
                已生成 {completedCount} 词
              </span>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="bg-white rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-[#FF5722]" />
                <h4 className="text-xs font-black uppercase tracking-widest text-[#202124]">10 个高频词发音注意点</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {result.vocab.map((item) => (
                  <div
                    key={item.word}
                    className="text-left rounded-xl border border-gray-100 p-3 bg-[#f8f9fa] hover:border-[#FF5722] hover:bg-white transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-base font-black text-[#202124]">{item.word}</div>
                      <SpeakButton text={item.word} title={`播放 ${item.word}`} />
                    </div>
                    <div className="text-xs text-blue-600 font-mono mt-0.5">{item.ipa}</div>
                    <div className="text-sm text-gray-600 mt-1.5">{item.meaning_zh}</div>
                    <div className="mt-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium p-2 leading-relaxed">
                      {item.pronunciation_note}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 italic leading-relaxed flex items-start justify-between gap-2">
                      <span>{item.example}</span>
                      <SpeakButton text={item.example} title="播放例句" className="flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#202124] rounded-xl border border-gray-900 p-3.5 text-white flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <TimerReset className="w-4 h-4 text-[#FF5722]" />
                  <h4 className="text-xs font-black uppercase tracking-widest">关联语法点</h4>
                </div>
                <div className="text-[11px] text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex flex-col gap-1 leading-relaxed">
                  <div><span className="text-gray-300 font-bold">作用：</span>提供造句骨架，完成发音到商务长句的闭环。</div>
                  <div><span className="text-gray-300 font-bold">用法：</span>结合高频词，对照正误示例跟读与造句。</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-5 flex flex-col">
                  <h5 className="text-xl font-black mb-2">{result.grammar.point}</h5>
                  <p className="text-gray-300 text-sm leading-relaxed">{result.grammar.explanation}</p>
                </div>
                <div className="lg:col-span-7 flex flex-col gap-2.5">
                  {result.grammar.examples.map((ex, idx) => (
                    <div key={idx} className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col md:flex-row gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Correct
                          </div>
                          <SpeakButton text={ex.correct} title="播放正确商务例句" />
                        </div>
                        <div className="text-sm text-white font-medium leading-relaxed">{ex.correct}</div>
                      </div>
                      <div className="hidden md:block w-px bg-white/10"></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
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

        {/* 基础唤醒追踪 */}
        <div className="bg-[#202124] rounded-xl p-3.5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
          <h4 className="text-xs font-black uppercase tracking-widest text-[#FF5722] mb-3 flex items-center">
            <Clock3 className="w-4 h-4 mr-2" /> 基础唤醒追踪
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1.5 flex-shrink-0">发音纠正 (10min/Day)</span>
              <div className="flex-1 min-h-0">
                <PronunciationTrainer
                  initialNotes={pronunciationNotes}
                  onNotesChange={setPronunciationNotes}
                  userId={getAppUserId()}
                />
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1.5 flex-shrink-0">核心语法复健 (8-10个核心点)</span>
              <div className="flex-1 min-h-0">
                <GrammarPolishTrainer
                  initialNotes={grammarNotes}
                  onNotesChange={setGrammarNotes}
                  userId={getAppUserId()}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </ModuleWrapper>
  );
}
