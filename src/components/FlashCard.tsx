import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Brain, CheckCircle2, XCircle, AlertTriangle, Zap, Loader2, BookOpen, Briefcase, Layout } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { getReviewWords, submitReview, VocabEntry, addWord, updateWordPayload } from '../services/vocabAPI';
import { runEnglishSentenceEvaluation, runWordEnrichment, toVocabEnrichmentPayload, type SentenceEvaluationResult } from '../services/difyAPI';

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
  const [sentenceInput, setSentenceInput] = useState('');
  const [isEvalLoading, setIsEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<SentenceEvaluationResult | null>(null);
  const [localPayload, setLocalPayload] = useState<any>(null);
  const [isEnriching, setIsEnriching] = useState(false);

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

  const current = words[currentIndex];
  const progress = session.total > 0 ? (session.done / session.total) * 100 : 0;

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  useEffect(() => {
    setLocalPayload(current?.payload || null);
    setSentenceInput('');
    setEvalResult(null);
    setIsFlipped(false);
  }, [current?.id]);

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
    const keys = ['translation_main', 'definition', 'definitions', 'meaning'];
    for (const k of keys) {
      if (payload[k] && typeof payload[k] === 'string') {
        return payload[k].slice(0, 120) + (payload[k].length > 120 ? '...' : '');
      }
    }
    return '';
  };

  const shouldEnrichPayload = (payload: any): boolean => {
    return !payload?.definition_en || payload?.meaning === '解析中...' || payload?.meaning === '待复习补充';
  };

  const currentPayload = localPayload || current?.payload || null;
  const currentDefinition = currentPayload?.definition_en || current?.payload?.definition_en || '';
  const currentBusinessNote = currentPayload?.business_note || current?.payload?.business_note || '';
  const currentExamples = currentPayload?.examples || current?.payload?.examples || [];

  const handleFlip = async () => {
    if (!current) return;

    if (isFlipped) {
      setIsFlipped(false);
      setEvalResult(null);
      return;
    }

    if (!shouldEnrichPayload(localPayload || current.payload)) {
      setIsFlipped(true);
      return;
    }

    setIsEnriching(true);
    try {
      const enriched = await runWordEnrichment(current.word);
      const normalized = {
        ...toVocabEnrichmentPayload(enriched),
        source: '闪卡自动补全',
      };
      setLocalPayload(normalized);
      await updateWordPayload(current.id, normalized);
    } catch (error) {
      console.error('闪卡自动补全失败:', error);
      setLocalPayload(prev => ({
        ...prev,
        meaning: prev?.meaning || '补全失败',
        definition_en: prev?.definition_en || '请检查 Dify 配置或网络。',
        business_note: prev?.business_note || '',
        examples: prev?.examples || [],
      }));
    } finally {
      setIsEnriching(false);
      setIsFlipped(true);
    }
  };

  const handleSentenceSubmit = async (targetWord: string) => {
    if (!sentenceInput.trim()) return;
    setIsEvalLoading(true);
    setEvalResult(null);
    try {
      const result = await runEnglishSentenceEvaluation(targetWord, sentenceInput);
      setEvalResult(result);
      if (result.isPass) {
        await addWord({
          word: targetWord,
          dictType: 'manual_capture',
          category: 'business',
          payload: { meaning: '句子考核通过', source: '闪卡造句评估' },
        });
      }
    } catch (error) {
      console.error('强制应用考核失败:', error);
      const message = error instanceof Error ? error.message : '请按 F12 查看控制台详情';
      alert(`长官，考核引擎异常:\n${message}`);
    } finally {
      setIsEvalLoading(false);
    }
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
              <div className="bg-gradient-to-br from-[#FF5722]/5 to-amber-50 border border-[#FF5722]/20 rounded-2xl p-6 text-center select-none">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="text-3xl font-black text-[#202124]">{current.word}</div>
                  <SpeakButton text={current.word} title={`播放 ${current.word}`} className="w-10 h-10" iconClassName="w-5 h-5" />
                </div>
                {!isFlipped && (
                  isEnriching ? (
                    <div className="mt-3 inline-flex items-center justify-center rounded-full bg-[#FF5722]/10 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-[#FF5722] border border-[#FF5722]/20 shadow-inner animate-pulse">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      正在接入总部数据库解密...
                    </div>
                  ) : (
                    <button
                      onClick={handleFlip}
                      className="mt-3 inline-flex items-center justify-center gap-1 rounded-full bg-[#202124] px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-[#FF5722] transition active:scale-95"
                    >
                      <BookOpen className="w-4 h-4" />
                      {shouldEnrichPayload(localPayload || current.payload) ? '点击连接 Dify 解密释义' : '翻转查看释义'}
                    </button>
                  )
                )}
              </div>

              {/* 背面：释义（翻转后显示） */}
              {isFlipped && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease] relative">
                  {/* 1. 核心释义 */}
                  <div>
                    <div className="text-[10px] font-black text-[#FF5722] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1 h-3 bg-[#FF5722] rounded-full inline-block" />
                      核心释义
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {getPayloadSummary(localPayload || current.payload) || '待补全'}
                    </div>
                  </div>

                  {/* 2. 英文定义 */}
                  <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> English Definition / 英文定义</span>
                      <SpeakButton text={currentDefinition} title="播放英文定义" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {currentDefinition || 'AI正在抓取此黑话的深层商务含义...'}
                    </div>
                  </div>

                  {/* 3. 商务注解 */}
                  <div>
                    <div className="text-[10px] font-black text-purple-500 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Business Context / 商务注解</span>
                      <SpeakButton text={currentBusinessNote} title="播放商务注解" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm text-[#d84315] leading-relaxed bg-[#FF5722]/5 p-4 rounded-2xl border border-[#FF5722]/10 italic">
                      {currentBusinessNote || '暂无特定商务场景备注。'}
                    </div>
                  </div>

                  {/* 4. 应用场景 */}
                  <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Layout className="w-3 h-3" /> Usage Scenarios / 应用场景
                    </div>
                    <div className="space-y-3">
                      {currentExamples.map((ex: string, i: number) => (
                        <div key={i} className="text-xs text-gray-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 relative pl-6 pr-11">
                          <div className="absolute left-2 top-3 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                          <span>{ex}</span>
                          <SpeakButton text={ex} title="播放应用场景例句" className="absolute right-2 top-2 w-7 h-7" iconClassName="w-3.5 h-3.5" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. 复习历史 */}
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

              <div className="mt-6 border-t border-gray-100 pt-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 block">
                  Mandatory Usage Test // 强制应用考核
                </label>
                <textarea
                  rows={3}
                  value={sentenceInput}
                  onChange={(e) => setSentenceInput(e.target.value)}
                  className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-[#FF5722]/30 rounded-xl p-4 text-sm text-[#202124] outline-none resize-none mb-3 shadow-inner"
                  placeholder={`请使用目标词汇造一个外企商务场景的句子...`}
                />
                <button
                  onClick={() => handleSentenceSubmit(current.word)}
                  disabled={isEvalLoading || !sentenceInput.trim()}
                  className="px-6 py-2.5 bg-[#202124] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 flex items-center cursor-pointer"
                >
                  {isEvalLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在提交高管审阅...</> : '提交造句'}
                </button>

                {evalResult && (
                  <div className={`mt-4 p-5 rounded-xl border ${evalResult.isPass ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} animate-[fadeIn_0.3s_ease-out]`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase tracking-widest flex items-center">
                        {evalResult.isPass ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2"/> : <XCircle className="w-4 h-4 text-red-600 mr-2"/>}
                        高管侧写评分：{evalResult.score} / 10
                      </span>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${evalResult.isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {evalResult.isPass ? 'APPROVED (允许升阶)' : 'REJECTED (打回重造)'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-4 font-medium leading-relaxed">{evalResult.feedback}</p>
                    <div className="text-xs bg-white p-4 pr-12 rounded-lg border border-gray-100 text-gray-800 font-serif relative">
                      <div className="absolute -left-1 top-4 w-1 h-8 bg-[#FF5722] rounded-r-md"></div>
                      <SpeakButton text={evalResult.correctedSentence} title="播放地道重构句" className="absolute right-3 top-3 w-7 h-7" iconClassName="w-3.5 h-3.5" />
                      <span className="font-bold text-[#FF5722] mr-2 text-[10px] uppercase tracking-widest">地道重构:</span>
                      <br />{evalResult.correctedSentence}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
