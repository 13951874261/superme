import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked, RefreshCw, Trash2, Brain, ChevronRight, Clock, AlertCircle, Settings2, RotateCcw, FastForward, Rewind, CheckCircle2 } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { getStats, getAllWords, deleteWord, manualIntervention, VocabEntry, VocabStats } from '../services/vocabAPI';
import FlashCard from './FlashCard';

export default function VocabularyBook() {
  const [vocabTab, setVocabTab] = useState<'business' | 'general'>('business');
  const [stats, setStats] = useState<VocabStats>({ total: 0, dueToday: 0 });
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFlashCard, setShowFlashCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" title={error} />
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
                >
                  <RefreshCw className="w-3.5 h-3.5" />
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
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="text-center text-gray-400 text-xs py-6">加载中...</div>
              ) : words.filter(w => w.category === vocabTab || (!w.category && vocabTab === 'business')).length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-6">
                  暂无词条，从词典查询后点击「收录」添加
                </div>
              ) : (
                words.filter(w => w.category === vocabTab || (!w.category && vocabTab === 'business')).map(word => (
                  <div
                    key={word.id}
                    onClick={() => handleWordClick(word)}
                    className="flex flex-col px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-[#202124] text-sm truncate">
                            {word.word}
                          </div>
                          <SpeakButton text={word.word} title={`播放 ${word.word}`} className="w-6 h-6 flex-shrink-0" iconClassName="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-300" />
                          <span className={`text-[10px] ${word.next_review_date <= Date.now() && word.repetitions < 999 ? 'text-[#FF5722] font-bold' : 'text-gray-400'}`}>
                            {word.repetitions === 999 ? '✅ 已归档，彻底掌握' : formatNextReview(word.next_review_date)}
                          </span>
                          {word.repetitions > 0 && word.repetitions !== 999 && (
                            <span className="text-[10px] text-gray-300">
                              · 第 {word.repetitions} 级复习
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 操作图标（悬浮显示） */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity ml-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex bg-white shadow-sm border border-gray-100 rounded-lg overflow-hidden mr-2">
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
                  </div>
                ))
              )}
            </div>

            {/* 底部：今日无任务提示 */}
            {!isLoading && stats.dueToday === 0 && stats.total > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 text-center text-[11px] text-emerald-500">
                ✅ 今日复习任务已完成
              </div>
            )}
          </div>
        )}
      </div>

      {/* 闪卡复习全屏 Portal */}
      {showFlashCard && (
        <FlashCard onClose={handleReviewDone} />
      )}
    </>
  );
}
