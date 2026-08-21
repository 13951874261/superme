import React, { useState, useEffect, useCallback, useRef, memo } from 'react';

import { BookMarked, RefreshCw, Trash2, Brain, ChevronRight, AlertCircle, RotateCcw, FastForward, Rewind, CheckCircle2, Pencil } from 'lucide-react';
import SpeakButton from './SpeakButton';
import {
  getStats,
  getVocabPage,
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
import { loadExpandedVocab } from '../services/vocabLoadCoordinator';
import FlashCard from './FlashCard';
import CustomCardModal from './CustomCardModal';
import MemoryAidPanel from './MemoryAidPanel';
import EbbinghausChart from './EbbinghausChart';
import VocabExportControl from './VocabExportControl';
import { getWordTranslation } from '../utils/vocabCsvExport';

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
function VocabularyBookComponent() {

  const PAGE_SIZE = 50;

  const [vocabTab, setVocabTab] = useState<'business' | 'general'>('business');
  const [stats, setStats] = useState<VocabStats>({ total: 0, dueToday: 0 });
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalWords, setTotalWords] = useState(0);
  const [pageInputValue, setPageInputValue] = useState('');
  const [showFlashCard, setShowFlashCard] = useState(false);
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportHint, setExportHint] = useState<string | null>(null);

  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [dueWords, setDueWords] = useState<VocabEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalWords / PAGE_SIZE));

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
      setError(null);
    } catch {
      setError('API 连接失败');
    }
  }, []);

  const loadWords = useCallback(async (page = 1, category = vocabTab) => {
    setIsLoading(true);
    setExpandedWordId(null);
    try {
      const cached = readReviewLightCache(category);
      if (cached) setDueWords(cached);

      const offset = (page - 1) * PAGE_SIZE;
      const { list, review } = await loadExpandedVocab(
        () => getVocabPage(category, offset, PAGE_SIZE),
        cached,
        () => getReviewWords(category, { light: true }).catch(() => [])
      );
      setWords(list.items);
      if (typeof list.total === 'number') setTotalWords(list.total);
      if (Array.isArray(review)) {
        setDueWords(review);
        writeReviewLightCache(category, review);
      }
      // 翻页后滚动回顶部
      if (listRef.current) listRef.current.scrollTop = 0;
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [vocabTab]);

  useEffect(() => {
    loadStats();
    // 预热到期队列缓存，供词汇矩阵毫秒级首屏
    const cached = readReviewLightCache(vocabTab);
    if (cached) setDueWords(cached);
    getReviewWords(vocabTab, { light: true })
      .then((review) => {
        setDueWords(review);
      })
      .catch(() => {});
    const timer = setInterval(loadStats, 60000);
    return () => clearInterval(timer);
  }, [loadStats, vocabTab]);

  useEffect(() => {
    const handleUpdate = () => {
      clearReviewLightCache(vocabTab);
      loadStats();
      if (isExpanded) {
        loadWords(currentPage, vocabTab);
      } else {
        getReviewWords(vocabTab, { light: true })
          .then((review) => {
            setDueWords(review);
          })
          .catch(() => {});
      }
    };

    const handleUserChange = () => {
      clearReviewLightCache('business');
      clearReviewLightCache('general');
      setCurrentPage(1);
      loadStats();
      if (isExpanded) {
        loadWords(1, vocabTab);
      } else {
        getReviewWords(vocabTab, { light: true })
          .then((review) => {
            setDueWords(review);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('vocab-updated', handleUpdate);
    window.addEventListener('global-user-id-changed', handleUserChange);
    return () => {
      window.removeEventListener('vocab-updated', handleUpdate);
      window.removeEventListener('global-user-id-changed', handleUserChange);
    };
  }, [loadStats, loadWords, isExpanded, vocabTab, currentPage]);

  const handleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      setCurrentPage(1);
      loadWords(1);
    }
  };

  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(p);
    loadWords(p);
  };

  const filteredWords = words;
  const dueInZone = dueWords.length;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteWord(id);
    clearReviewLightCache(vocabTab);
    setWords(prev => prev.filter(w => w.id !== id));
    setDueWords(prev => prev.filter(w => w.id !== id));
    setTotalWords(prev => Math.max(0, prev - 1));
    loadStats();
  };

  const handleIntervention = async (id: string, action: 'restart' | 'step-back' | 'step-forward' | 'master', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await manualIntervention(id, action);
      clearReviewLightCache(vocabTab);
      loadStats();
      loadWords(currentPage);
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
    if (isExpanded) loadWords(currentPage);
  };

  const selectVocabTab = (category: 'business' | 'general') => {
    if (category === vocabTab) return;
    setVocabTab(category);
    setWords([]);
    setDueWords([]);
    setCurrentPage(1);
    setTotalWords(0);
    loadWords(1, category);
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
                生词本
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
                  onClick={(e) => { e.stopPropagation(); selectVocabTab('business'); }}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider transition-all ${vocabTab === 'business' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >政商务区</button>
                <button
                  onClick={(e) => { e.stopPropagation(); selectVocabTab('general'); }}
                  className={`text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-wider transition-all ${vocabTab === 'general' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >全场景区</button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-px h-5 bg-gray-200 mx-0.5 hidden sm:block" aria-hidden />
                <button
                  onClick={(e) => { e.stopPropagation(); loadWords(currentPage); }}
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
            >
              {isLoading ? (
                <div className="text-center text-gray-400 text-xs py-6">加载中...</div>
              ) : filteredWords.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-6">
                  暂无词条，从词典查询后点击「收录」添加
                </div>
              ) : (
                <div>
                  {filteredWords.map(word => {
                  const payload = word.payload || {};
                  const pos = payload.pos || '';
                  const phonetic = payload.phonetic || '';
                  const translation = getWordTranslation(word);
                  const isOpened = expandedWordId === word.id;
                  const isPeek = peekId === word.id;

                  return (
                    <div key={word.id} className="flex flex-col border-b border-gray-50 last:border-0 hover:bg-zinc-500/5 transition-all transform-gpu" style={{ minHeight: ROW_ESTIMATE_H }}>

                      <div
                        onClick={() => handleWordClick(word)}
                        onMouseEnter={() => setPeekId(word.id)}
                        onMouseLeave={() => setPeekId((id) => (id === word.id ? null : id))}
                        className={`flex items-start justify-between px-3.5 py-2.5 cursor-pointer group transition-colors ${isOpened ? 'bg-amber-50/40' : ''}`}
                      >
                        <div className="flex-1 min-w-0 pr-1.5">
                          <div className="flex items-center gap-1.5 w-full">
                            <div className="flex-1 min-w-0 relative group/word py-0.5">
                              <div
                                className="font-extrabold text-zinc-800 text-sm truncate cursor-pointer select-text"
                                title={word.word}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeekId((id) => (id === word.id ? null : word.id));
                                }}
                              >
                                {word.word}
                              </div>
                              {word.word.length > 12 && (
                                <div className="word-tooltip-container">
                                  <span className="word-tooltip-text font-black font-mono">
                                    {word.word}
                                  </span>
                                </div>
                              )}
                            </div>
                            {pos && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold shrink-0 select-none">
                                {pos}
                              </span>
                            )}
                            {phonetic && (
                              <span
                                className="text-[10px] font-mono text-slate-400 select-none truncate max-w-[80px] shrink-0"
                                title={phonetic}
                              >
                                [{phonetic}]
                              </span>
                            )}
                            <SpeakButton text={word.word} title={`播放 ${word.word}`} className="w-5 h-5 flex-shrink-0" iconClassName="w-2.5 h-2.5" />
                          </div>

                          {translation && (
                            <div
                              className="text-xs text-slate-600 mt-1 font-medium break-words whitespace-normal leading-relaxed pl-0.5"
                              title={translation}
                            >
                              {translation}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {word.repetitions === 999 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 select-none shrink-0">
                                已掌握
                              </span>
                            ) : word.next_review_date <= Date.now() ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500 text-white select-none shrink-0">
                                今日待复习
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 select-none shrink-0">
                                {formatNextReview(word.next_review_date)}
                              </span>
                            )}
                            {word.repetitions > 0 && word.repetitions !== 999 && (
                              <span className="text-[8px] text-slate-400 font-mono tracking-tight shrink-0">
                                #{word.repetitions}次复习
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="relative ml-2 shrink-0 flex items-center justify-end min-w-[120px] h-9">
                          {/* 非悬停状态：展示复习进度面板 */}
                          <div className="flex flex-col items-end justify-center transition-opacity duration-200 group-hover:opacity-0 group-hover:pointer-events-none text-right select-none">
                            <div className="text-[10px] text-slate-500 font-medium leading-tight">
                              {word.repetitions === 999 ? (
                                <span className="text-emerald-600 font-bold">已归档掌握</span>
                              ) : (
                                <>第 <span className="font-bold text-slate-700">{word.repetitions || 0}</span> 轮 · 间隔 <span className="font-bold text-slate-700">{word.interval_days || 1}</span> 天</>
                              )}
                            </div>
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden flex" title={`记忆因子: ${word.ease_factor || 2.5}`}>
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  word.repetitions === 999 
                                    ? 'bg-emerald-500 w-full' 
                                    : (word.ease_factor || 2.5) >= 2.5 
                                      ? 'bg-emerald-400' 
                                      : (word.ease_factor || 2.5) >= 2.0 
                                        ? 'bg-amber-400' 
                                        : 'bg-orange-400'
                                }`}
                                style={{
                                  width: word.repetitions === 999 ? '100%' : `${Math.min(100, Math.max(15, (((word.ease_factor || 2.5) - 1.3) / (3.0 - 1.3)) * 100))}%`
                                }}
                              />
                            </div>
                          </div>

                          {/* 悬停状态：显示操作按钮 */}
                          <div className="absolute right-0 opacity-0 group-hover:opacity-100 flex items-center transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
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

            {/* ===== 标准数字分页器 ===== */}
            {!isLoading && totalWords > PAGE_SIZE && (() => {
              const maxPageButtons = 5;
              let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
              const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
              if (endPage - startPage < maxPageButtons - 1) {
                startPage = Math.max(1, endPage - maxPageButtons + 1);
              }
              const pageButtons: number[] = [];
              for (let i = startPage; i <= endPage; i++) pageButtons.push(i);

              return (
                <div className="border-t border-gray-100 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap select-none">
                  {/* 左侧：总数信息 */}
                  <span className="text-[10px] text-slate-400 shrink-0">
                    共 {totalWords} 词，第 {currentPage}/{totalPages} 页
                  </span>

                  {/* 中间：翻页控件 */}
                  <div className="flex items-center gap-1">
                    {/* 首页 */}
                    <button
                      disabled={currentPage === 1}
                      onClick={() => goToPage(1)}
                      className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      «
                    </button>
                    {/* 上一页 */}
                    <button
                      disabled={currentPage === 1}
                      onClick={() => goToPage(currentPage - 1)}
                      className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      ‹
                    </button>

                    {/* 页码按钮 */}
                    {startPage > 1 && (
                      <>
                        <button onClick={() => goToPage(1)} className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition">1</button>
                        {startPage > 2 && <span className="text-[10px] text-slate-400 px-0.5">…</span>}
                      </>
                    )}
                    {pageButtons.map(p => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`px-2 py-1 text-[10px] font-bold rounded border transition ${
                          p === currentPage
                            ? 'bg-[#FF5722] border-[#FF5722] text-white shadow-sm'
                            : 'border-gray-200 text-slate-500 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    {endPage < totalPages && (
                      <>
                        {endPage < totalPages - 1 && <span className="text-[10px] text-slate-400 px-0.5">…</span>}
                        <button onClick={() => goToPage(totalPages)} className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition">{totalPages}</button>
                      </>
                    )}

                    {/* 下一页 */}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                      className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      ›
                    </button>
                    {/* 尾页 */}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(totalPages)}
                      className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      »
                    </button>
                  </div>

                  {/* 右侧：跳页输入 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400">跳至</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const p = parseInt(pageInputValue, 10);
                          if (!isNaN(p)) goToPage(p);
                          setPageInputValue('');
                        }
                      }}
                      placeholder={String(currentPage)}
                      className="w-12 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded text-center text-slate-600 focus:outline-none focus:border-[#FF5722]"
                    />
                    <button
                      onClick={() => {
                        const p = parseInt(pageInputValue, 10);
                        if (!isNaN(p)) goToPage(p);
                        setPageInputValue('');
                      }}
                      className="px-2 py-1 text-[10px] font-bold rounded border border-gray-200 text-slate-500 hover:bg-gray-50 transition"
                    >
                      Go
                    </button>
                  </div>
                </div>
              );
            })()}

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
            clearReviewLightCache(vocabTab);
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

const VocabularyBook = memo(VocabularyBookComponent);
export default VocabularyBook;

