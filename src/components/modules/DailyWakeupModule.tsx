import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, CheckCircle2, Clock3, Loader2, TimerReset, Volume2, Zap } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import SpeakButton from '../SpeakButton';
import { useVocabCollect } from '../../hooks/useVocabCollect';
import { showToast } from '../Toast';
import PronunciationTrainer from './PronunciationTrainer';
import GrammarPolishTrainer from './GrammarPolishTrainer';
import { useEnglishContext } from './english/context/EnglishContext';
import { getTodayDailyPack, regenerateDailyPack, WakeupPayload, WakeupWord, buildDailyPackQueryInput } from '../../services/dailyPackAPI';
import { lookupVocabWords } from '../../services/vocabAPI';
import { upsertTrainingSession } from '../../services/trainingAPI';
import { getAppUserId } from '../../utils/profileHelper';
import {
  VOCAB_ZONE_LABEL,
  VOCAB_ZONE_COLLECT_BTN,
  type VocabCategory,
} from '../../utils/vocabZoneLabels';

interface WakeupResult extends WakeupPayload {}

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
  const [packStatus, setPackStatus] = useState<'missing' | 'ready' | 'failed' | 'generating' | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string>('等待开始今日唤醒');
  const {
    collect,
    hydrateFromEntries,
    getCollectingZone,
    getQueuedZone,
    getStoredCategory,
  } = useVocabCollect({
    notify: (message, type) => showToast({ message, type }),
  });
  
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

  const applyPack = (pack: Awaited<ReturnType<typeof getTodayDailyPack>>) => {
    setPackStatus(pack.status);
    if (pack.status === 'ready' && pack.wakeup) {
      setResult(pack.wakeup);
      const dedupeNotice = pack.wakeup._dedupeNotice;
      setNotice(
        pack.stale
          ? `这份材料还是按「${pack.theme}」生成的，点刷新按「${pack.currentTheme || theme}」重做。`
          : (dedupeNotice || `已加载今日唤醒：${pack.currentTheme || theme}`),
      );
      return true;
    }
    setResult(null);
    if (pack.status === 'failed') {
      setNotice(pack.errorMessage || '今日唤醒生成失败，可立即生成');
    } else if (pack.status === 'generating') {
      setNotice('暂无可用缓存，请点击「刷新今日包」手动生成');
    } else {
      setNotice(`暂无缓存（${getAppUserId()}），请点击「刷新今日包」手动生成`);
    }
    return false;
  };

  const loadTodayPack = async (reason: string) => {
    try {
      // D1: 与破绽/生成共用稳定入参，避免空 history 与满 history 两套签名
      const queryInput = await buildDailyPackQueryInput(theme);
      const pack = await getTodayDailyPack(queryInput);
      applyPack(pack);
      return pack;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '加载失败';
      setNotice(`读取今日包失败：${msg}`);
      return null;
    }
  };

  useEffect(() => {
    void loadTodayPack('theme');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const refreshIfEmpty = () => {
      if (document.visibilityState !== 'visible') return;
      if (result || loading) return;
      void loadTodayPack('visibility');
    };
    document.addEventListener('visibilitychange', refreshIfEmpty);
    window.addEventListener('focus', refreshIfEmpty);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfEmpty);
      window.removeEventListener('focus', refreshIfEmpty);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, loading]);

  const handleStartPractice = () => {
    if (!result) {
      setNotice('请先生成今日唤醒内容');
      return;
    }
    void refreshStayStats(true);
    void refreshTodaySession();
    startTimer();
    setNotice(`练习计时已开始：${result.theme || theme}`);
  };

  const handleRegenerate = async () => {
    if (loading) return;
    setLoading(true);
    setNotice(result ? '正在重新为您定制今日专属唤醒训练…' : '正在为您智能定制今日专属唤醒训练...');
    try {
      void refreshStayStats(true);
      void refreshTodaySession();
      const queryInput = await buildDailyPackQueryInput(theme);
      const pack = await regenerateDailyPack('wakeup', queryInput);
      if (pack.status !== 'ready' || !pack.wakeup) {
        const cached = await getTodayDailyPack(queryInput).catch(() => null);
        if (cached && applyPack(cached)) return;
        throw new Error(pack.errorMessage || '今日专属唤醒内容定制中');
      }
      applyPack(pack);
      startTimer();
    } catch (error) {
      const queryInput = await buildDailyPackQueryInput(theme).catch(() => null);
      const cached = queryInput ? await getTodayDailyPack(queryInput).catch(() => null) : null;
      if (cached && applyPack(cached)) {
        startTimer();
        return;
      }
      setPackStatus('failed');
      const fallbackMsg = '今日唤醒包正在后台加速准备，您可先在生词本或听力模块进行热身';
      setNotice(fallbackMsg);
      try {
        const { showToast } = await import('../Toast');
        showToast({ message: fallbackMsg, type: 'info' });
      } catch (err) {}
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

  // 逐条收录唤醒高频词：收录即补齐词汇矩阵，3 秒未完成转入任务中心
  const handleCollectWord = async (
    item: WakeupWord,
    category: VocabCategory,
    anchor?: HTMLElement | null,
  ) => {
    const stored = getStoredCategory(item.word);
    await collect({
      text: item.word,
      category,
      migrateOnly: !!stored && stored !== category,
      topic: result?.theme || theme,
      source: 'Daily Wakeup',
      payload: {
        source: 'Daily Wakeup',
        topic: result?.theme || theme,
      },
      anchor,
    });
  };

  const completedCount = useMemo(() => result?.vocab?.length || 0, [result]);

  useEffect(() => {
    const words = result?.vocab?.map((item) => item.word).filter(Boolean) || [];
    if (words.length === 0) return;
    let cancelled = false;
    const syncCollected = () => {
      void lookupVocabWords(words).then((items) => {
        if (cancelled || !items.length) return;
        hydrateFromEntries(items);
      }).catch(() => {});
    };
    syncCollected();
    window.addEventListener('vocab-updated', syncCollected);
    return () => {
      cancelled = true;
      window.removeEventListener('vocab-updated', syncCollected);
    };
  }, [result, hydrateFromEntries]);

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
      title="每日唤醒 ｜ 发音与语法练习"
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
                {result ? (
                  <>
                    <button
                      onClick={handleStartPractice}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-white text-[#202124] font-black text-xs tracking-wide hover:bg-[#FF5722] hover:text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      开始练习
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white font-black text-xs tracking-wide hover:bg-white/10 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TimerReset className="w-3.5 h-3.5" />}
                      {loading ? '生成中' : '重新生成'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleRegenerate}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-white text-[#202124] font-black text-xs tracking-wide hover:bg-[#FF5722] hover:text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {loading ? '生成中' : packStatus === 'failed' ? '立即生成' : '开始今日唤醒'}
                  </button>
                )}
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
                <span className="truncate" title={notice}>{notice}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {!result && (
                  <button
                    type="button"
                    onClick={() => void loadTodayPack('manual')}
                    className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    刷新今日包
                  </button>
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  已生成 {completedCount} 词
                </span>
              </span>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="bg-white rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-[#FF5722]" />
                <h4 className="text-xs font-black uppercase tracking-widest text-[#202124]">今日主题专业词（3+2）</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {result.vocab.map((item) => (
                  <div
                    key={item.word}
                    className="text-left rounded-xl border border-gray-100 p-3 bg-[#f8f9fa] hover:border-[#FF5722] hover:bg-white transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-black text-[#202124]">{item.word}</div>
                        <SpeakButton text={item.word} title={`播放 ${item.word}`} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(['business', 'general'] as VocabCategory[]).map((zone) => {
                          const activeZone = getCollectingZone(item.word);
                          const isCollectingHere = activeZone === zone;
                          const isQueuedHere = getQueuedZone(item.word) === zone;
                          const isStoredHere = getStoredCategory(item.word) === zone;

                          return (
                            <button
                              key={zone}
                              onClick={(e) => {
                                if (activeZone && activeZone !== zone) {
                                  showToast({ message: `正在收录至${VOCAB_ZONE_LABEL[activeZone]}，请稍候`, type: 'info' });
                                  return;
                                }
                                void handleCollectWord(item, zone, e.currentTarget);
                              }}
                              disabled={isCollectingHere || isQueuedHere || isStoredHere}
                              title={isStoredHere ? `已在${VOCAB_ZONE_LABEL[zone]}` : `收录至${VOCAB_ZONE_LABEL[zone]}`}
                              className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 disabled:cursor-default ${
                                isStoredHere
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : isQueuedHere
                                    ? 'text-blue-700 bg-blue-50 border-blue-200'
                                    : 'text-[#FF5722] bg-orange-50 border-orange-200 hover:bg-[#FF5722] hover:text-white'
                              }`}
                            >
                              {isCollectingHere || isQueuedHere ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isStoredHere ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <BookmarkPlus className="w-3 h-3" />
                              )}
                              {isCollectingHere
                                ? '收录中'
                                : isQueuedHere
                                  ? '后台处理中'
                                  : isStoredHere
                                    ? '已收录'
                                    : VOCAB_ZONE_COLLECT_BTN[zone]}
                            </button>
                          );
                        })}
                      </div>
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
                  <h5 className="text-xl font-black mb-2">{result.grammar?.point || '暂无语法点'}</h5>
                  <p className="text-gray-300 text-sm leading-relaxed">{result.grammar?.explanation || '暂无语法讲解。'}</p>
                </div>
                <div className="lg:col-span-7 flex flex-col gap-2.5">
                  {(result.grammar?.examples || []).map((ex, idx) => (
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
