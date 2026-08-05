import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BookMarked, RefreshCw, Trash2, Brain, ChevronRight, AlertCircle, RotateCcw, FastForward, Rewind, CheckCircle2, Pencil } from 'lucide-react';
import SpeakButton from './SpeakButton';
import {
  getStats,
  getAllWords,
  getReviewWords,
  getVocabItem,
  deleteWord,
  manualIntervention,
  getEbbinghausData,
  VocabEntry,
  VocabStats,
  EbbinghausData,
  clearReviewLightCache,
  readReviewLightCache,
  writeReviewLightCache,
} from '../services/vocabAPI';
import FlashCard from './FlashCard';
import CustomCardModal from './CustomCardModal';
import MemoryAidPanel from './MemoryAidPanel';
import EbbinghausChart from './EbbinghausChart';
import VocabExportControl from './VocabExportControl';
import { getWordTranslation } from '../utils/vocabCsvExport';

const LIST_VIEWPORT_H = 550;
const ROW_ESTIMATE_H = 92;

// ==========================================
// 生词本内联详情展示组件 (手风琴展开内容)
// ==========================================
interface InlineWordDetailProps {
  word: VocabEntry;
}

function InlineWordDetail({ word }: InlineWordDetailProps) {
  const [activeTab, setActiveTab] = useState<'definition' | 'memory' | 'ebbinghaus'>('definition');
  const [ebbinghausData, setEbbinghausData] = useState<EbbinghausData | null>(null);
  const [ebbLoading, setEbbLoading] = useState(false);
  const [ebbError, setEbbError] = useState<string | null>(null);
  const [fullWord, setFullWord] = useState<VocabEntry>(word);

  useEffect(() => {
    setFullWord(word);
    if (word._light) {
      getVocabItem(word.id)
        .then((item) => setFullWord({ ...item, _light: false }))
        .catch(() => {});
    }
  }, [word]);

  useEffect(() => {
    if (activeTab === 'ebbinghaus' && !ebbinghausData) {
      setEbbLoading(true);
      setEbbError(null);
      getEbbinghausData(word.id)
        .then(data => {
          setEbbinghausData(data);
        })
        .catch(err => {
          console.error(err);
          setEbbError('获取曲线数据失败，请重试');
        })
        .finally(() => {
          setEbbLoading(false);
        });
    }
  }, [activeTab, word.id, ebbinghausData]);

  const payload = fullWord.payload || {};
  const translation = getWordTranslation(fullWord);

  return (
    <div className="bg-slate-50/70 border-t border-slate-100 p-4 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
      <div className="flex border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('definition')}
          className={`flex-1 text-[11px] font-bold pb-1 border-b-2 text-center transition-all ${activeTab === 'definition' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          完整释义
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex-1 text-[11px] font-bold pb-1 border-b-2 text-center transition-all ${activeTab === 'memory' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          记忆辅助
        </button>
        <button
          onClick={() => setActiveTab('ebbinghaus')}
          className={`flex-1 text-[11px] font-bold pb-1 border-b-2 text-center transition-all ${activeTab === 'ebbinghaus' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          遗忘曲线
        </button>
      </div>

      <div className="text-left">
        {activeTab === 'definition' && (
          <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2.5 max-h-[220px] overflow-y-auto shadow-sm">
            <div className="text-xs text-slate-700 leading-relaxed font-medium">
              {translation || <span className="text-slate-400">暂无中文释义</span>}
            </div>

            {payload.example_sentences && payload.example_sentences.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-50 space-y-1">
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">精选例句</div>
                {payload.example_sentences.slice(0, 2).map((s: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-slate-600 leading-relaxed">
                    {typeof s === 'object' ? (
                      <>
                        <div className="font-semibold text-slate-700">{s.en}</div>
                        <div className="text-slate-500">{s.zh}</div>
                      </>
                    ) : (
                      <div>{s}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'memory' && (
          <MemoryAidPanel wordId={word.id} wordText={word.word} />
        )}

        {activeTab === 'ebbinghaus' && (
          <div>
            {ebbLoading && (
              <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                加载曲线数据中...
              </div>
            )}
            {ebbError && (
              <div className="text-center py-8 text-xs text-red-500 font-bold">
                {ebbError}
              </div>
            )}
            {ebbinghausData && (
              <EbbinghausChart data={ebbinghausData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 主生词本组件
// ==========================================
export default function VocabularyBook() {
  const [vocabTab, setVocabTab] = useState<'business' | 'general'>('business');
  const [stats, setStats] = useState<VocabStats>({ total: 0, dueToday: 0 });
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFlashCard, setShowFlashCard] = useState(false);
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportHint, setExportHint] = useState<string | null>(null);

  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [dueWords, setDueWords] = useState<VocabEntry[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
      setError(null);
    } catch {
      setError('API 连接失败');
    }
  }, []);

  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = readReviewLightCache();
      if (cached) setDueWords(cached);

      const [list, review] = await Promise.all([
        getAllWords({ light: true }),
        getReviewWords({ light: true }).catch(() => cached || []),
      ]);
      setWords(list);
      if (Array.isArray(review)) {
        setDueWords(review);
        writeReviewLightCache(review);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // 预热到期队列缓存，供词汇矩阵毫秒级首屏
    const cached = readReviewLightCache();
    if (cached) setDueWords(cached);
    getReviewWords({ light: true })
      .then((review) => {
        setDueWords(review);
        setStats((prev) => ({ ...prev, dueToday: review.length }));
      })
      .catch(() => {});
    const timer = setInterval(loadStats, 60000);
    return () => clearInterval(timer);
  }, [loadStats]);

  useEffect(() => {
    const handleUpdate = () => {
      clearReviewLightCache();
      loadStats();
      if (isExpanded) {
        loadWords();
      } else {
        getReviewWords({ light: true })
          .then((review) => {
            setDueWords(review);
            setStats((prev) => ({ ...prev, dueToday: review.length }));
          })
          .catch(() => {});
      }
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [loadStats, loadWords, isExpanded]);

  const handleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) loadWords();
  };

  const filteredWords = useMemo(
    () => words.filter((w) => w.category === vocabTab || (!w.category && vocabTab === 'business')),
    [words, vocabTab]
  );

  const dueInZone = useMemo(
    () =>
      dueWords.filter((w) => w.category === vocabTab || (!w.category && vocabTab === 'business')).length,
    [dueWords, vocabTab]
  );

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_ESTIMATE_H) - 3);
  const visibleCount = Math.ceil(LIST_VIEWPORT_H / ROW_ESTIMATE_H) + 6;
  const endIdx = Math.min(filteredWords.length, startIdx + visibleCount);
  const virtualSlice = filteredWords.slice(startIdx, endIdx);
  const padTop = startIdx * ROW_ESTIMATE_H;
  const padBottom = Math.max(0, (filteredWords.length - endIdx) * ROW_ESTIMATE_H);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteWord(id);
    clearReviewLightCache();
    setWords(prev => prev.filter(w => w.id !== id));
    setDueWords(prev => prev.filter(w => w.id !== id));
    loadStats();
  };

  const handleIntervention = async (id: string, action: 'restart' | 'step-back' | 'step-forward' | 'master', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await manualIntervention(id, action);
      clearReviewLightCache();
      loadStats();
      loadWords();
    } catch {
      // ignore
    }
  };

  const handleWordClick = (word: VocabEntry) => {
    setExpandedWordId(prev => prev === word.id ? null : word.id);
    const event = new CustomEvent('vocab-view', { detail: word });
    window.dispatchEvent(event);
  };

  const handleReviewDone = () => {
    setShowFlashCard(false);
    loadStats();
    if (isExpanded) loadWords();
  };

  const formatNextReview = (ts: number) => {
    const diff = ts - Date.now();
    if (diff <= 0) return '今日';

    if (diff < 60 * 60 * 1000) {
      return `${Math.ceil(diff / 60000)} 分钟后`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.ceil(diff / 3600000)} 小时后`;
    }
    return `${Math.ceil(diff / 86400000)} 天后`;
  };

  return (
    <>
      <div className="px-6 pb-8">
        <div
          onClick={handleExpand}
          className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-3 shadow-sm cursor-pointer hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-xl text-amber-500">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[#202124] text-sm flex items-center gap-2">
                艾宾浩斯生词本
                {error && (
                  <span title={error}><AlertCircle className="w-3.5 h-3.5 text-red-400" /></span>
                )}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                共 {stats.total} 词
                {stats.dueToday > 0 && (
                  <span className="ml-1.5 text-[#FF5722] font-bold animate-pulse">
                    {stats.dueToday} 待复习
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.dueToday > 0 && (
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5722]" />
              </span>
            )}
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* 操作栏：分区 | 次要操作簇 | 主操作复习 */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-50 flex-wrap">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={(e) => { e.stopPropagation(); setVocabTab('business'); }}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider transition-all ${vocabTab === 'business' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >政商务区</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setVocabTab('general'); }}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider transition-all ${vocabTab === 'general' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >全场景区</button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-px h-5 bg-gray-200 mx-0.5 hidden sm:block" aria-hidden />
                <button
                  onClick={(e) => { e.stopPropagation(); loadWords(); }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  title="刷新词条"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <VocabExportControl
                  compact
                  currentTab={vocabTab}
                  words={words.length ? words : undefined}
                  onExported={(count) => {
                    setExportHint(`已导出 ${count} 条`);
                    window.setTimeout(() => setExportHint(null), 2500);
                  }}
                  onError={(msg) => {
                    setExportHint(msg);
                    window.setTimeout(() => setExportHint(null), 3000);
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCustomCardModal(true); }}
                  className="flex items-center gap-1 border border-[#FF5722]/30 text-[#FF5722] hover:bg-[#FF5722]/5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
                >
                  + 制卡
                </button>
                {dueInZone > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFlashCard(true); }}
                    className="flex items-center gap-1.5 bg-[#FF5722] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg hover:bg-[#E64A19] transition shadow-sm shadow-[#FF5722]/20"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    复习 {dueInZone}
                  </button>
                )}
              </div>
            </div>

            {exportHint && (
              <div className="px-4 py-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 border-b border-slate-50">
                {exportHint}
              </div>
            )}

            <div
              ref={listRef}
              className="divide-y divide-gray-50 border-t border-gray-100 max-h-[550px] overflow-y-auto scrollbar-thin"
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              {isLoading ? (
                <div className="text-center text-gray-400 text-xs py-6">加载中...</div>
              ) : filteredWords.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-6">
                  暂无词条，从词典查询后点击「收录」添加
                </div>
              ) : (
                <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
                  {virtualSlice.map(word => {
                  const payload = word.payload || {};
                  const pos = payload.pos || '';
                  const phonetic = payload.phonetic || '';
                  const translation = getWordTranslation(word);
                  const isOpened = expandedWordId === word.id;
                  const isPeek = peekId === word.id;

                  return (
                    <div key={word.id} className="flex flex-col border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition" style={{ minHeight: ROW_ESTIMATE_H }}>
                      <div
                        onClick={() => handleWordClick(word)}
                        onMouseEnter={() => setPeekId(word.id)}
                        onMouseLeave={() => setPeekId((id) => (id === word.id ? null : id))}
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer group transition-colors ${isOpened ? 'bg-amber-50/40' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div
                              className={`font-bold text-[#202124] text-sm min-w-0 ${isPeek || isOpened ? 'whitespace-normal break-words' : 'truncate'}`}
                              title={word.word}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPeekId((id) => (id === word.id ? null : word.id));
                              }}
                            >
                              {word.word}
                            </div>
                            {pos && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-medium shrink-0 select-none">
                                {pos}
                              </span>
                            )}
                            {phonetic && (
                              <span
                                className={`text-[10px] font-mono text-slate-400 select-none shrink ${isPeek || isOpened ? 'whitespace-normal break-all' : 'truncate max-w-[90px]'}`}
                                title={phonetic}
                              >
                                [{phonetic}]
                              </span>
                            )}
                            <SpeakButton text={word.word} title={`播放 ${word.word}`} className="w-6 h-6 flex-shrink-0" iconClassName="w-3 h-3" />
                          </div>

                          {translation && (
                            <div
                              className={`text-xs text-slate-600 mt-0.5 font-medium ${isPeek || isOpened ? 'whitespace-normal break-words' : 'truncate max-w-[85%]'}`}
                              title={translation}
                            >
                              {translation}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {word.repetitions === 999 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 select-none shrink-0">
                                已掌握
                              </span>
                            ) : word.next_review_date <= Date.now() ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500 text-white select-none shrink-0">
                                今日
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500 select-none shrink-0">
                                {formatNextReview(word.next_review_date)}
                              </span>
                            )}
                            {word.repetitions > 0 && word.repetitions !== 999 && (
                              <span className="text-[8px] text-slate-400 shrink-0">
                                #{word.repetitions}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex bg-white/95 shadow-sm border border-gray-100 rounded-lg overflow-hidden mr-1.5 backdrop-blur-sm">
                            <button
                              title="编辑"
                              onClick={(e) => { e.stopPropagation(); setEditingWord(word); }}
                              className="px-1.5 py-1 text-gray-400 hover:bg-orange-50 hover:text-[#FF5722] transition border-r border-gray-100"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="重新学习（第一节点）"
                              onClick={(e) => handleIntervention(word.id, 'restart', e)}
                              className="px-1.5 py-1 text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition border-r border-gray-100"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="退回"
                              onClick={(e) => handleIntervention(word.id, 'step-back', e)}
                              className="px-1.5 py-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition border-r border-gray-100"
                            >
                              <Rewind className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="跳过"
                              onClick={(e) => handleIntervention(word.id, 'step-forward', e)}
                              className="px-1.5 py-1 text-gray-400 hover:bg-slate-50 hover:text-slate-600 transition border-r border-gray-100"
                            >
                              <FastForward className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="归档"
                              onClick={(e) => handleIntervention(word.id, 'master', e)}
                              className="px-1.5 py-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={(e) => handleDelete(word.id, e)}
                            className="text-gray-300 hover:text-red-400 p-1 transition rounded-lg"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isOpened && (
                        <InlineWordDetail word={word} />
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </div>

            {!isLoading && stats.dueToday === 0 && stats.total > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-center gap-1.5 text-[11px] text-emerald-500 font-bold bg-emerald-50/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>今日复习任务已完成</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showFlashCard && (
        <FlashCard onClose={handleReviewDone} />
      )}

      {showCustomCardModal && (
        <CustomCardModal
          onClose={() => setShowCustomCardModal(false)}
          onSuccess={() => {
            setShowCustomCardModal(false);
            clearReviewLightCache();
            loadStats();
            if (isExpanded) loadWords();
            window.dispatchEvent(new Event('vocab-updated'));
          }}
        />
      )}

      {editingWord && (
        <CustomCardModal
          editWord={editingWord}
          onClose={() => setEditingWord(null)}
          onSuccess={() => {
            setEditingWord(null);
            loadStats();
            if (isExpanded) loadWords();
            window.dispatchEvent(new Event('vocab-updated'));
          }}
        />
      )}
    </>
  );
}
