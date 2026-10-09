import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { buildDailyPackQueryInput, getTodayDailyPack, regenerateDailyPack, withDailyPackRace, waitDailyPackUntilReady, DAILY_PACK_RACE_MS, friendlyDailyPackError } from '../../services/dailyPackAPI';
import { getAppUserId } from '../../utils/profileHelper';
import { useVocabCollect } from '../../hooks/useVocabCollect';
import { lookupVocabWords } from '../../services/vocabAPI';
import { showToast } from '../Toast';
import SpeakButton from '../SpeakButton';
import { useEnglishContext } from './english/context/EnglishContext';
import { useTask } from '../TaskContext';
import { notifyBackgroundHandoff } from '../../utils/backgroundHandoff';
import {
  VOCAB_ZONE_LABEL,
  VOCAB_ZONE_COLLECT_BTN,
  classifyCollectKind,
  type VocabCategory,
} from '../../utils/vocabZoneLabels';

interface FlawVocabWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

export default function DailyErrorVocabularyModule() {
  const { theme } = useEnglishContext();
  const [words, setWords] = useState<FlawVocabWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackground, setIsBackground] = useState(false);
  const pendingRef = useRef<{ theme: string; userId: string } | null>(null);
  const mountedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [staleHint, setStaleHint] = useState<string | null>(null);
  const { addTask } = useTask();
  const regenBtnRef = useRef<HTMLButtonElement | null>(null);
  const {
    collect,
    hydrateFromEntries,
    getCollectingZone,
    getQueuedZone,
    getStoredCategory,
  } = useVocabCollect({
    notify: (message, type) => showToast({ message, type }),
  });

  const applyFlawPack = (pack: Awaited<ReturnType<typeof getTodayDailyPack>>) => {
    if (pack.status === 'ready' && Array.isArray(pack.flawVocab) && pack.flawVocab.length > 0) {
      setWords(pack.flawVocab.slice(0, 6));
      setStaleHint(
        pack.stale
          ? `这份材料还是按「${pack.theme}」生成的，点刷新按「${pack.currentTheme || theme}」重做。`
          : null,
      );
      setError(null);
      return true;
    }
    setStaleHint(null);
    return false;
  };

  const fetchFlawVocab = async (regenerate = false) => {
    const userId = getAppUserId();
    if (pendingRef.current?.theme === theme && pendingRef.current.userId === userId) return;
    const run = { theme, userId };
    pendingRef.current = run;
    const isCurrent = () => mountedRef.current && pendingRef.current === run && getAppUserId() === userId;
    const deadline = Date.now() + DAILY_PACK_RACE_MS;
    setIsLoading(true);
    setIsBackground(false);
    setError(null);

    const work = (async () => {
      const queryInput = await buildDailyPackQueryInput(theme);
      if (!isCurrent()) throw new Error('请求已取消');
      let pack: Awaited<ReturnType<typeof getTodayDailyPack>> | undefined;
      try {
        const cached = await withDailyPackRace(getTodayDailyPack(queryInput, userId), Math.max(0, deadline - Date.now()));
        if ('result' in cached) pack = cached.result;
      } catch (err) {
        if (!/请求超时|唤醒服务暂时连不上/.test(friendlyDailyPackError(err))) throw err;
      }
      if (!isCurrent()) throw new Error('请求已取消');
      if (!regenerate && pack?.status === 'ready' && pack.flawVocab?.length) return pack;
      // 已有生成任务只接续轮询；回执丢失先查缓存，禁止盲目重提。
      if (pack?.status !== 'generating') {
        try {
          pack = await regenerateDailyPack('flaw', queryInput, userId);
        } catch (err) {
          if (!/请求超时|唤醒服务暂时连不上/.test(friendlyDailyPackError(err))) throw err;
          pack = await getTodayDailyPack(queryInput, userId);
          if (pack.status !== 'generating' && !(pack.status === 'ready' && pack.flawVocab?.length)) {
            throw new Error('后台任务提交未确认，请点击重试');
          }
        }
      }
      if (pack.taskId && getAppUserId() === userId) {
        addTask({
          id: pack.taskId,
          type: 'daily_pack',
          name: `每日破绽词汇｜${queryInput.theme || theme}`,
          status: 'running',
          progress: 20,
          logs: ['已受理，正在后台生成今日破绽词汇'],
        });
      }
      if (pack.status === 'failed' || (pack.status === 'ready' && pack.flawVocab?.length)) return pack;
      return waitDailyPackUntilReady('flaw', queryInput, userId);
    })().then((pack) => {
      if (isCurrent() && !applyFlawPack(pack)) {
        setError(friendlyDailyPackError(pack.errorMessage) || '后台生成未完成，请点击重试');
      }
    }).catch((err) => {
      if (isCurrent()) setError(friendlyDailyPackError(err) || '获取每日破绽词汇失败，请重试');
    }).finally(() => {
      if (isCurrent()) {
        setIsLoading(false);
        setIsBackground(false);
      }
      if (pendingRef.current === run) pendingRef.current = null;
    });

    // 整条链路共用 3 秒预算，包含输入准备、缓存读取、生成回执。
    const raced = await withDailyPackRace(work);
    if (raced.isTimeout && isCurrent()) {
      setIsLoading(false);
      setIsBackground(true);
      notifyBackgroundHandoff({
        anchor: regenBtnRef.current,
        message: '3 秒未命中缓存，已转入后台生成，可在【任务中心】查看进度',
        tone: 'info',
        toast: true,
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setWords([]);
    setStaleHint(null);
    void fetchFlawVocab(false);
  }, [theme]);

  useEffect(() => {
    const texts = words.map((item) => item.word).filter(Boolean);
    if (texts.length === 0) return;
    let cancelled = false;
    const syncCollected = () => {
      void lookupVocabWords(texts).then((items) => {
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
  }, [words, hydrateFromEntries]);

  // 逐条收录：收录即补齐词汇矩阵，3 秒未完成转入任务中心
  const handleAddWord = async (
    word: FlawVocabWord,
    category: VocabCategory,
    anchor?: HTMLElement | null,
  ) => {
    const { isPhrase, isSentence } = classifyCollectKind(word.word);
    await collect({
      text: word.word,
      category,
      isPhrase,
      isSentence,
      migrateOnly: !!getStoredCategory(word.word) && getStoredCategory(word.word) !== category,
      topic: theme,
      source: 'Daily Flaw Vocab',
      payload: {
        source: 'Daily Flaw Vocab',
        topic: theme,
      },
      anchor,
    });
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 border border-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.12)] relative overflow-hidden mb-6 animate-fade-in">
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h4 className="text-base font-black tracking-widest uppercase flex items-center gap-2">
              每日破绽词汇
            </h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {staleHint || '今日预生成 · 可刷新'}
            </p>
          </div>
        </div>
        <button
          ref={regenBtnRef}
          onClick={() => void fetchFlawVocab(true)}
          disabled={isLoading || isBackground}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-slate-700/50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          刷新词汇
        </button>
      </div>

      {isBackground && (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-6 text-sm text-indigo-300">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          正在后台生成，可在【任务中心】查看进度，完成后自动显示。
        </div>
      )}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">正在加载今日易错词汇…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
          <p className="text-sm text-red-400 font-semibold mb-4">{error}</p>
          <button
            ref={regenBtnRef}
            onClick={() => void fetchFlawVocab(true)}
            className="px-5 py-2.5 bg-[var(--color-brand)] text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            重试
          </button>
        </div>
      ) : words.length === 0 ? (
        !isBackground && (
          <div className="text-center py-12 text-slate-500 text-sm font-medium">暂无数据，请尝试刷新</div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {words.map((item) => (
            <div
              key={item.word}
              className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group flex flex-col justify-between text-left"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">
                    {item.word}
                  </span>
                  <SpeakButton text={item.word} title={`朗读 ${item.word}`} className="text-slate-400 hover:text-indigo-400" />
                </div>
                <span className="text-xs font-mono text-indigo-400 block mb-2">{item.ipa}</span>
                <p className="text-sm text-slate-200 font-black mb-1">{item.meaning_zh}</p>
                <p className="text-xs text-slate-400 leading-relaxed font-medium mb-3">{item.pronunciation_note}</p>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed italic relative mb-4">
                  <span className="absolute -top-2 left-3 px-1.5 bg-slate-900 rounded text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Example</span>
                  <div className="pt-1 flex items-start justify-between gap-2">
                    <span>{item.example}</span>
                    <SpeakButton text={item.example} title="朗读例句" className="shrink-0 text-slate-500 hover:text-indigo-400 mt-0.5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                        void handleAddWord(item, zone, e.currentTarget);
                      }}
                      disabled={isCollectingHere || isQueuedHere || isStoredHere}
                      title={isStoredHere ? `已在${VOCAB_ZONE_LABEL[zone]}` : `收录至${VOCAB_ZONE_LABEL[zone]}`}
                      className={`py-2.5 rounded-xl text-[11px] font-black tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isStoredHere
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isQueuedHere
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-md hover:shadow-[var(--color-brand)]/20'
                      }`}
                    >
                      {isCollectingHere || isQueuedHere ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isStoredHere ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : null}
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
          ))}
        </div>
      )}
    </div>
  );
}
