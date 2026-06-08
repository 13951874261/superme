import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked, RefreshCw, Trash2, Brain, ChevronRight, Clock, AlertCircle, RotateCcw, FastForward, Rewind, CheckCircle2, Pencil } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { getStats, getAllWords, deleteWord, manualIntervention, getEbbinghausData, VocabEntry, VocabStats, EbbinghausData } from '../services/vocabAPI';
import FlashCard from './FlashCard';
import CustomCardModal from './CustomCardModal';
import MemoryAidPanel from './MemoryAidPanel';
import EbbinghausChart from './EbbinghausChart';

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

  const payload = word.payload || {};
  const phonetic = payload.phonetic || '';
  const translation = payload.definition || payload.translation_main || (Array.isArray(payload.definitions_en) ? payload.definitions_en[0] : '');
  const pos = payload.pos || '';

  return (
    <div className="bg-slate-50/70 border-t border-slate-100 p-4 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
      {/* 选项卡导航 */}
      <div className="flex border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('definition')}
          className={`flex-1 text-[11px] font-black pb-1 border-b-2 text-center transition-all ${activeTab === 'definition' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          完整释义
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`flex-1 text-[11px] font-black pb-1 border-b-2 text-center transition-all ${activeTab === 'memory' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          记忆辅助
        </button>
        <button
          onClick={() => setActiveTab('ebbinghaus')}
          className={`flex-1 text-[11px] font-black pb-1 border-b-2 text-center transition-all ${activeTab === 'ebbinghaus' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          遗忘曲线
        </button>
      </div>

      {/* 选项卡内容 */}
      <div className="text-left">
        {activeTab === 'definition' && (
          <div className="bg-white border border-slate-100 rounded-xl p-3.5 space-y-2.5 max-h-[220px] overflow-y-auto shadow-sm">
            <div className="text-xs text-slate-700 leading-relaxed font-medium">
              {translation || <span className="text-slate-400 italic">暂无中文释义</span>}
            </div>
            
            {/* 商务/通用例句渲染 */}
            {payload.example_sentences && payload.example_sentences.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-50 space-y-1">
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">精选例句</div>
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
  
  // 新增：展开的单词 ID 状态 (手风琴效果)
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
      setError(null);
    } catch (e: any) {
      setError('API 连接失败');
    }
  }, []);

  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getAllWords();
      setWords(list);
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // 每分钟刷新一次统计
    const timer = setInterval(loadStats, 60000);
    return () => clearInterval(timer);
  }, [loadStats]);

  // 监听全局事件，实现实时无感更新
  useEffect(() => {
    const handleUpdate = () => {
      loadStats();
      if (isExpanded) {
        loadWords();
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteWord(id);
    setWords(prev => prev.filter(w => w.id !== id));
    loadStats();
  };

  const handleIntervention = async (id: string, action: 'restart' | 'step-back' | 'step-forward' | 'master', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await manualIntervention(id, action);
      loadStats();
      loadWords();
    } catch {
      // ignore
    }
  };

  const handleWordClick = (word: VocabEntry) => {
    // 切换当前行的折叠面板
    setExpandedWordId(prev => prev === word.id ? null : word.id);
    // 派发事件让 DictionaryPanel 截获并展示
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
    if (diff <= 0) return '今日待复习';
    
    // 按时间跨度返回直观展示
    if (diff < 60 * 60 * 1000) {
      return `${Math.ceil(diff / 60000)} 分钟后复习`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.ceil(diff / 3600000)} 小时后复习`;
    }
    return `${Math.ceil(diff / 86400000)} 天后复习`;
  };

  return (
    <>
      {/* 侧边栏生词本区域 */}
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
              <div className="text-[11px] text-gray-400 mt-0.5">
                共 {stats.total} 词
                {stats.dueToday > 0 && (
                  <span className="ml-2 text-[#FF5722] font-bold">
                    · {stats.dueToday} 待复习
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.dueToday > 0 && (
              <span className="bg-[#FF5722] text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {stats.dueToday}
              </span>
            )}
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {/* 展开列表 */}
        {isExpanded && (
          <div className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* 操作栏 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={(e) => { e.stopPropagation(); setVocabTab('business'); }}
                  className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest transition-all ${vocabTab === 'business' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >政商务区</button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setVocabTab('general'); }}
                  className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-widest transition-all ${vocabTab === 'general' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >全场景区</button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadWords}
                  className="text-gray-400 hover:text-gray-600 transition"
                  title="刷新词条"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCustomCardModal(true); }}
                  className="flex items-center gap-1 border border-[#FF5722] text-[#FF5722] hover:bg-[#FF5722]/5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg transition"
                >
                  + 制卡
                </button>
                {stats.dueToday > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFlashCard(true); }}
                    className="flex items-center gap-1 bg-[#FF5722] text-white text-[11px] font-bold px-3 py-1 rounded-lg hover:bg-[#E64A19] transition"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    开始复习
                  </button>
                )}
              </div>
            </div>

            {/* 词条列表 */}
            <div className="divide-y divide-gray-50 border-t border-gray-100 max-h-[550px] overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="text-center text-gray-400 text-xs py-6">加载中...</div>
              ) : words.filter(w => w.category === vocabTab || (!w.category && vocabTab === 'business')).length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-6">
                  暂无词条，从词典查询后点击「收录」添加
                </div>
              ) : (
                words.filter(w => w.category === vocabTab || (!w.category && vocabTab === 'business')).map(word => {
                  const payload = word.payload || {};
                  const pos = payload.pos || '';
                  const phonetic = payload.phonetic || '';
                  const translation = payload.definition || payload.translation_main || (Array.isArray(payload.definitions_en) ? payload.definitions_en[0] : '');
                  const isOpened = expandedWordId === word.id;

                  return (
                    <div key={word.id} className="flex flex-col border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition">
                      {/* 主行 */}
                      <div
                        onClick={() => handleWordClick(word)}
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer group transition-colors ${isOpened ? 'bg-indigo-50/20' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-bold text-[#202124] text-sm min-w-0 truncate">
                                {word.word}
                              </div>
                              {pos && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold shrink-0 select-none">
                                  {pos}
                                </span>
                              )}
                              {phonetic && (
                                <span className="text-[10px] font-mono text-slate-400 font-medium select-none truncate max-w-[90px] shrink-1">
                                  [{phonetic}]
                                </span>
                              )}
                              <SpeakButton text={word.word} title={`播放 ${word.word}`} className="w-6 h-6 flex-shrink-0" iconClassName="w-3 h-3" />
                            </div>
                            
                            {/* 核心释义预览 (已展开时则隐藏，避免与详情重合) */}
                            {translation && !isOpened && (
                              <div className="text-[11px] text-gray-500 truncate mt-0.5 max-w-[85%] font-medium">
                                {translation}
                              </div>
                            )}

                            {/* 艾宾浩斯复习状态高颜值 Pill Badge */}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {word.repetitions === 999 ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100/50 select-none shrink-0">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                  <span>已归档，已掌握</span>
                                </span>
                              ) : word.next_review_date <= Date.now() ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50/70 text-amber-600 border border-amber-100/50 select-none shrink-0">
                                  <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                  <span>今日待复习</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-50 text-gray-500 border border-gray-100/60 select-none shrink-0">
                                  <Clock className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                                  <span>{formatNextReview(word.next_review_date)}</span>
                                </span>
                              )}
                              {word.repetitions > 0 && word.repetitions !== 999 && (
                                <span className="text-[9px] text-gray-400 shrink-0 bg-slate-50 border border-slate-100/50 px-1.5 py-0.5 rounded-full font-medium">
                                  第 {word.repetitions} 级复习
                                </span>
                              )}
                            </div>
                        </div>
                        
                        {/* 操作图标（悬浮显示） */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex bg-white shadow-sm border border-gray-100 rounded-lg overflow-hidden mr-2">
                            <button
                              title="编辑卡片内容"
                              onClick={(e) => { e.stopPropagation(); setEditingWord(word); }}
                              className="px-2 py-1 text-gray-400 hover:bg-orange-50 hover:text-[#FF5722] transition border-r border-gray-100"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              title="重新学习（第一节点）"
                              onClick={(e) => handleIntervention(word.id, 'restart', e)}
                              className="px-2 py-1 text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition border-r border-gray-100"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              title="退回上一节点"
                              onClick={(e) => handleIntervention(word.id, 'step-back', e)}
                              className="px-2 py-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition border-r border-gray-100"
                            >
                              <Rewind className="w-3 h-3" />
                            </button>
                            <button
                              title="跳过至下一节点"
                              onClick={(e) => handleIntervention(word.id, 'step-forward', e)}
                              className="px-2 py-1 text-gray-400 hover:bg-purple-50 hover:text-purple-500 transition border-r border-gray-100"
                            >
                              <FastForward className="w-3 h-3" />
                            </button>
                            <button
                              title="在此次循环中停止推荐（归档）"
                              onClick={(e) => handleIntervention(word.id, 'master', e)}
                              className="px-2 py-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500 transition"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={(e) => handleDelete(word.id, e)}
                            className="text-gray-300 hover:text-red-400 p-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 内联折叠手风琴面板 */}
                      {isOpened && (
                        <InlineWordDetail word={word} />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 底部：今日无任务提示 */}
            {!isLoading && stats.dueToday === 0 && stats.total > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-center gap-1.5 text-[11px] text-emerald-500 font-bold bg-emerald-50/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>今日复习任务已完成</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 闪卡复习全屏 Portal */}
      {showFlashCard && (
        <FlashCard onClose={handleReviewDone} />
      )}

      {/* 自定义制卡全屏 Portal */}
      {showCustomCardModal && (
        <CustomCardModal
          onClose={() => setShowCustomCardModal(false)}
          onSuccess={() => {
            setShowCustomCardModal(false);
            loadStats();
            if (isExpanded) loadWords();
          }}
        />
      )}

      {/* 闪卡编辑全屏 Portal */}
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
