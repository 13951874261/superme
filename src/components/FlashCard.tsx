import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, RotateCcw, ChevronRight, Brain, CheckCircle2, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { getReviewWords, submitReview, VocabEntry } from '../services/vocabAPI';
import { renderValue } from './DictionaryPanel';

interface FlashCardProps {
  onClose: () => void;
}

interface ReviewSession {
  total: number;
  done: number;
  results: Array<{ word: string; quality: number }>;
}

const QUALITY_OPTIONS = [
  { value: 0, label: '完全忘记', color: 'bg-red-100 text-red-600 hover:bg-red-200', icon: <XCircle className="w-4 h-4" /> },
  { value: 2, label: '朦胧记得', color: 'bg-orange-100 text-orange-600 hover:bg-orange-200', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 4, label: '记住了', color: 'bg-blue-100 text-blue-600 hover:bg-blue-200', icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: 5, label: '非常熟练', color: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200', icon: <Zap className="w-4 h-4" /> },
];

export default function FlashCard({ onClose }: FlashCardProps) {
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [session, setSession] = useState<ReviewSession>({ total: 0, done: 0, results: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getReviewWords();
      setWords(list);
      setSession({ total: list.length, done: 0, results: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const current = words[currentIndex];
  const progress = session.total > 0 ? (session.done / session.total) * 100 : 0;

  const handleQuality = async (quality: number) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(current.id, quality);
      const newResults = [...session.results, { word: current.word, quality }];
      const newDone = session.done + 1;

      setSession(prev => ({ ...prev, done: newDone, results: newResults }));

      if (currentIndex + 1 >= words.length) {
        setIsFinished(true);
        setSession(prev => ({ ...prev, done: newDone, results: newResults }));
      } else {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getPayloadSummary = (payload: any): string => {
    if (!payload) return '';
    const keys = ['translation_main', 'definition', 'definitions'];
    for (const k of keys) {
      if (payload[k] && typeof payload[k] === 'string') {
        return payload[k].slice(0, 120) + (payload[k].length > 120 ? '...' : '');
      }
    }
    return '';
  };

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#FF5722]" />
            <span className="font-black text-[#202124] text-sm">
              艾宾浩斯复习
            </span>
            {!isFinished && !isLoading && (
              <span className="text-[11px] text-gray-400 ml-2">
                {session.done + 1} / {session.total}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 进度条 */}
        {!isFinished && !isLoading && session.total > 0 && (
          <div className="h-1 bg-gray-100 mx-6 mt-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF5722] to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* 主体内容 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="text-center py-16 text-gray-400 text-sm">加载复习词条...</div>
          )}

          {!isLoading && words.length === 0 && (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <div className="font-bold text-[#202124] mb-1">今日无需复习</div>
              <div className="text-xs text-gray-400">继续使用词典查询并收录新词吧</div>
            </div>
          )}

          {!isLoading && isFinished && (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
              <div className="font-black text-xl text-[#202124] mb-2">复习完成！</div>
              <div className="text-sm text-gray-500 mb-6">
                共完成 {session.total} 个词条的复习
              </div>
              {/* 本次统计 */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {QUALITY_OPTIONS.map(q => {
                  const count = session.results.filter(r => r.quality === q.value).length;
                  return (
                    <div key={q.value} className={`rounded-xl p-3 ${q.color}`}>
                      <div className="text-xl font-black">{count}</div>
                      <div className="text-[10px] mt-0.5 font-bold">{q.label}</div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={onClose}
                className="bg-[#FF5722] text-white font-bold px-8 py-3 rounded-xl hover:bg-[#E64A19] transition"
              >
                完成
              </button>
            </div>
          )}

          {!isLoading && !isFinished && current && (
            <div className="px-6 py-6 flex flex-col gap-4">
              {/* 正面：词条 */}
              <div
                className="bg-gradient-to-br from-[#FF5722]/5 to-amber-50 border border-[#FF5722]/20 rounded-2xl p-6 text-center cursor-pointer select-none"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className="text-3xl font-black text-[#202124] mb-2">{current.word}</div>
                {!isFlipped && (
                  <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1 mt-3">
                    <RotateCcw className="w-3 h-3" />
                    点击翻转查看释义
                  </div>
                )}
              </div>

              {/* 背面：释义（翻转后显示） */}
              {isFlipped && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease]">
                  {/* 核心释义 */}
                  {getPayloadSummary(current.payload) && (
                    <div>
                      <div className="text-[10px] font-black text-[#FF5722] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span className="w-1 h-3 bg-[#FF5722] rounded-full inline-block" />
                        核心释义
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed">
                        {getPayloadSummary(current.payload)}
                      </div>
                    </div>
                  )}

                  {/* 商务例句（如有） */}
                  {current.payload?.business_examples && Array.isArray(current.payload.business_examples) && (
                    <div>
                      <div className="text-[10px] font-black text-purple-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span className="w-1 h-3 bg-purple-400 rounded-full inline-block" />
                        商务例句
                      </div>
                      {current.payload.business_examples.slice(0, 1).map((ex: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 space-y-1">
                          {ex.zh && <div>🇨🇳 {ex.zh}</div>}
                          {ex.en && <div className="text-gray-400 italic">🇺🇸 {ex.en}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 复习历史 */}
                  <div className="text-[10px] text-gray-300 text-right">
                    已复习 {current.repetitions} 次 · 间隔 {current.interval_days} 天
                  </div>
                </div>
              )}

              {/* 打分按钮（翻转后显示） */}
              {isFlipped && (
                <div>
                  <div className="text-[11px] text-gray-400 text-center mb-2">你的掌握程度？</div>
                  <div className="grid grid-cols-4 gap-2">
                    {QUALITY_OPTIONS.map(q => (
                      <button
                        key={q.value}
                        onClick={() => handleQuality(q.value)}
                        disabled={submitting}
                        className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl font-bold text-[11px] transition disabled:opacity-50 ${q.color}`}
                      >
                        {q.icon}
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 跳过按钮 */}
              {!isFlipped && (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="w-full flex items-center justify-center gap-1 bg-[#FF5722] text-white font-bold py-3 rounded-xl hover:bg-[#E64A19] transition text-sm"
                >
                  查看释义
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
