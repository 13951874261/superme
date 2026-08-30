import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Brain, CheckCircle2, XCircle, AlertTriangle, Zap, Loader2, BookOpen, Briefcase } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { getReviewPage, submitReview, VocabEntry, updateWordPayload } from '../services/vocabAPI';
import { runEnglishSentenceEvaluation, runWordEnrichment, toVocabEnrichmentPayload, type SentenceEvaluationResult } from '../services/difyAPI';
import { appendErrorLedgerEntries } from '../utils/errorLedgerHelper';
import { isVocabPlaceholder, shouldAutoEnrichVocab, toVocabPresentation, extractSynonymsAntonymsCollocations } from '../utils/vocabCsvExport';
import { useEnglishContext } from './modules/english/context/EnglishContext';
import MemoryAidPanel from './MemoryAidPanel';

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
  const { theme } = useEnglishContext();
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
  const [enrichError, setEnrichError] = useState('');

  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await getReviewPage('business', 50, 0);
      setWords(page.items);
      setCurrentIndex(0);
      setSession({ total: page.items.length, done: 0, results: [] });
      setIsFinished(page.items.length === 0);
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
    setEnrichError('');
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
        // 已提交的词会被移出到期队列，下一批必须从更新后的队列首项读取，
        // 否则 offset 会跳过尚未复习的词。
        const nextPage = await getReviewPage('business', 50, 0);
        if (nextPage.items.length === 0) {
          setIsFinished(true);
          setSession(prev => ({ ...prev, done: newDone, results: newResults }));
        } else {
          setWords(nextPage.items);
          setCurrentIndex(0);
          setSession({ total: nextPage.items.length, done: 0, results: [] });
          setIsFlipped(false);
        }
      } else {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentPayload = localPayload || current?.payload || null;
  const currentDefinitionRaw = currentPayload?.definition_en || current?.payload?.definition_en || '';
  const currentBusinessNoteRaw = currentPayload?.business_note || current?.payload?.business_note || '';
  const currentDefinition = isVocabPlaceholder(currentDefinitionRaw) ? '' : currentDefinitionRaw;
  const currentBusinessNote = isVocabPlaceholder(currentBusinessNoteRaw) ? '' : currentBusinessNoteRaw;
  const card = current
    ? toVocabPresentation({ ...current, payload: currentPayload || current.payload })
    : null;

  const handleFlip = async () => {
    if (!current) return;

    if (isFlipped) {
      setIsFlipped(false);
      setEvalResult(null);
      return;
    }

    if (!shouldAutoEnrichVocab(current.word, localPayload || current.payload)) {
      setIsFlipped(true);
      return;
    }

    setIsEnriching(true);
    setEnrichError('');
    try {
      const enriched = await runWordEnrichment(current.word, theme);
      const normalized = {
        ...toVocabEnrichmentPayload(enriched),
        source: '闪卡自动补全',
      };
      setLocalPayload(normalized);
      await updateWordPayload(current.id, normalized);
    } catch (error) {
      console.error('闪卡自动补全失败:', error);
      setEnrichError('释义补全失败，请检查网络后重试。');
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
      const result = await runEnglishSentenceEvaluation(targetWord, sentenceInput, theme);
      setEvalResult(result);
      if (!result.isPass) {
        void appendErrorLedgerEntries('vocab', [{
          word: targetWord,
          score: result.score,
          feedback: result.feedback,
          theme,
          source: 'flashcard',
        }]);
      }
    } catch (error) {
      console.error('强制应用考核失败:', error);
      const message = error instanceof Error ? error.message : '请按 F12 查看控制台详情';
      console.error('评分失败:', message);
      alert('评分失败，请稍后重试');
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
              记忆复习
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
              <div className="bg-gradient-to-br from-[#FF5722]/5 to-amber-50 border border-[#FF5722]/20 rounded-2xl p-6 text-center select-none shadow-sm shadow-[#FF5722]/5">
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <div className="text-4xl font-black text-[#202124] tracking-tight">{current.word}</div>
                    <SpeakButton
                      text={current.word}
                      title={`播放 ${current.word}`}
                      className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100"
                      iconClassName="w-5 h-5 text-[#FF5722]"
                    />
                  </div>
                  {(localPayload || current.payload)?.phonetic && (
                    <div className="text-sm text-slate-400 font-mono">
                      [{(localPayload || current.payload).phonetic}]
                    </div>
                  )}
                </div>
                {!isFlipped && (
                  isEnriching ? (
                    <div className="mt-2 inline-flex items-center justify-center rounded-full bg-[#FF5722]/10 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-[#FF5722] border border-[#FF5722]/20 shadow-inner animate-pulse">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      正在解密释义...
                    </div>
                  ) : (
                    <button
                      onClick={handleFlip}
                      className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#202124] px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-[#FF5722] transition active:scale-95 shadow-lg shadow-[#202124]/20"
                    >
                      <BookOpen className="w-4 h-4" />
                      {shouldAutoEnrichVocab(current.word, localPayload || current.payload) ? '点击加载释义' : '翻转查看释义'}
                    </button>
                  )
                )}
              </div>

              {/* 背面：按词条类型分层（原词 / 释义 / 短语 / 例句） */}
              {isFlipped && card && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-[fadeIn_0.2s_ease] relative">
                  {((card.phonetic && card.phonetic !== '/') || (card.pos && card.pos !== 'phrase' && card.pos !== 'sentence')) && (
                    <div className="text-xs text-slate-400 font-mono">
                      {card.phonetic && card.phonetic !== '/' ? `[${card.phonetic}]` : ''}
                      {card.pos && card.pos !== 'phrase' && card.pos !== 'sentence' ? `  ${card.pos}` : ''}
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-black text-[#FF5722] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1 h-3 bg-[#FF5722] rounded-full inline-block" />
                      释义
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {card.translation || '暂无释义'}
                    </div>
                  </div>

                  {card.itemType === '单词 (Word)' && card.relatedPhrase && (
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">短语</div>
                      <div className="text-sm text-gray-700">{card.relatedPhrase}</div>
                    </div>
                  )}

                  {card.itemType !== '句子 (Sentence)' && (card.primaryExampleEn || card.primaryExampleZh) && (
                    <div>
                      <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                        <span>例句</span>
                        {card.primaryExampleEn && (
                          <SpeakButton text={card.primaryExampleEn} title="播放例句" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
                        )}
                      </div>
                      {card.primaryExampleEn && (
                        <div className="text-sm font-medium text-slate-800 leading-relaxed">{card.primaryExampleEn}</div>
                      )}
                      {card.primaryExampleZh && (
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{card.primaryExampleZh}</div>
                      )}
                    </div>
                  )}

                  {currentDefinition && (
                    <div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> English Definition / 英文定义</span>
                        <SpeakButton text={currentDefinition} title="播放英文定义" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {currentDefinition}
                      </div>
                    </div>
                  )}

                  {currentBusinessNote && (
                    <div>
                      <div className="text-[10px] font-black text-[var(--color-accent)] uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Business Context / 商务注解</span>
                        <SpeakButton text={currentBusinessNote} title="播放商务注解" className="w-7 h-7" iconClassName="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm text-[#d84315] leading-relaxed bg-[#FF5722]/5 p-4 rounded-2xl border border-[#FF5722]/10 italic">
                        {currentBusinessNote}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const ext = extractSynonymsAntonymsCollocations(current?.word || '', currentPayload);
                    return (
                      <>
                        {ext.synonyms.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1.5">近义词 (Synonyms)</div>
                            <div className="flex flex-wrap gap-1.5">
                              {ext.synonyms.map((s: string, idx: number) => (
                                <span key={idx} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ext.antonyms.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1.5">反义词 (Antonyms)</div>
                            <div className="flex flex-wrap gap-1.5">
                              {ext.antonyms.map((a: string, idx: number) => (
                                <span key={idx} className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ext.collocations.length > 0 && (
                          <div>
                            <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1.5">常用搭配 (Collocations)</div>
                            <div className="flex flex-wrap gap-1.5 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/60">
                              {ext.collocations.map((coll: string, idx: number) => (
                                <span key={idx} className="text-xs font-bold text-indigo-800 bg-white border border-indigo-200/80 px-2.5 py-1 rounded-lg">
                                  {coll}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {enrichError && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      {enrichError}
                    </div>
                  )}

                  {/* 记忆辅助面板 */}
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <MemoryAidPanel wordId={current.id} wordText={current.word} />
                  </div>

                  <div className="text-[10px] text-gray-300 text-right mt-2">
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
                        {evalResult.isPass ? '通过（可继续）' : '未通过（请重写）'}
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
