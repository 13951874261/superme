import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, Loader2, CheckCircle2, Zap, Briefcase, Globe, CalendarCheck, Library, BrainCircuit, XCircle, AlertTriangle, Activity, ShieldAlert } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { submitReview, getReviewWords, getVocabItem, readReviewLightCache, writeReviewLightCache, clearReviewLightCache, getMemoryAids, type MemoryAids } from '../../../../services/vocabAPI';
import { runEnglishSentenceEvaluation } from '../../../../services/difyAPI';
import { appendErrorLedgerEntries } from '../../../../utils/errorLedgerHelper';
import { playSuccess, playError, playScan, playPageTurn } from '../../../../utils/soundEffects';
import CustomCardModal from '../../../CustomCardModal';
import MemoryAidPanel from '../../../MemoryAidPanel';
import VocabExportControl from '../../../VocabExportControl';
import { ZhModernView, EnEnBusinessView, EnZhBidirectionalView } from '../../../DictionaryPanel';
import { showError, showSuccess } from '../../../Toast';
import MemoryMatrixStage from './vocab/MemoryMatrixStage';

// --- Payload Adapter ---
function adaptWordPayload(word: any) {
  if (!word) return { type: '', payload: null };
  const payload = word.payload || {};
  const dictType = word.dict_type || '';

  // 如果 payload 已经是标准词典结构之一，直接返回
  if (payload.translation_main || payload.definitions_en || payload.definition) {
    let resolvedType = dictType;
    if (dictType === 'manual_capture' || dictType === 'ai_extracted' || dictType === 'ai_phrase') {
      if (payload.translation_main) resolvedType = 'en_zh_bidirectional';
      else if (payload.definitions_en) resolvedType = 'en_en_business';
      else if (payload.definition) resolvedType = 'zh_modern';
    }
    return { type: resolvedType, payload };
  }

  // 否则，它是 Dify 划线提纯/自动补全的扁平格式，适配为 en_en_business（商务英英）格式
  const adaptedPayload: any = {
    headword: word.word,
    pos: payload.partOfSpeech || payload.pos || '',
    phonetic: payload.phonetic || '',
    meaning_zh: payload.meaning || payload.meaning_zh || '',
    definitions_en: payload.definition_en ? [payload.definition_en] : [],
    business_notes: payload.business_note || payload.businessNote || '',
    scenarios: Array.isArray(payload.examples)
      ? payload.examples.map((ex: any) => ({
          scene: '商务场景',
          example_en: typeof ex === 'string' ? ex : (ex.en || ex.example || '')
        }))
      : [],
    other_meanings: [],
    example_sentences: Array.isArray(payload.examples)
      ? payload.examples.filter((ex: any) => typeof ex === 'string' ? ex.trim() : (ex.en || ex.zh || ''))
      : [],
    synonyms: Array.isArray(payload.synonyms) ? payload.synonyms : [],
    antonyms: Array.isArray(payload.antonyms) ? payload.antonyms : [],
    collocations: Array.isArray(payload.collocations) ? payload.collocations : [],
  };

  return {
    type: 'en_en_business',
    payload: adaptedPayload
  };
}

export default function VocabTab() {
  const {
    activeTab,
    theme,
    vocabZone, setVocabZone,
    dueWords, setDueWords,
    currentWordIdx, setCurrentWordIdx,
    sentenceInput, setSentenceInput,
    isEvaluating, setIsEvaluating,
    loadingDueWords, setLoadingDueWords,
    inlineNotice, noticeAnchor, showNotice,
    pendingSentenceDebt, setPendingSentenceDebt
  } = useEnglishContext();

  const [evalResult, setEvalResult] = useState<{ quality: number; feedback: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isFallback, setIsFallback] = useState(false); // true=全量练习模式，false=今日复习模式
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Anki 闪卡拼写状态
  const [isFlipped, setIsFlipped] = useState(false);
  const [spellInput, setSpellInput] = useState('');
  const [isSpellError, setIsSpellError] = useState(false);
  const [submittingQuality, setSubmittingQuality] = useState(false);

  const reloadVocab = useCallback(async () => {
    // Cache-first：毫秒级出队
    const cached = readReviewLightCache(vocabZone);
    if (cached && cached.length > 0) {
      setDueWords(cached);
      setIsFallback(false);
      setLoadingDueWords(false);
      setIsSyncing(true);
    } else {
      setLoadingDueWords(true);
    }

    try {
      let data;
      try {
        data = await getReviewWords(vocabZone, { light: true });
      } catch {
        data = await getReviewWords(vocabZone, { light: true });
      }
      if (Array.isArray(data) && data.length > 0) {
        setDueWords(data);
        writeReviewLightCache(vocabZone, data);
        setIsFallback(false);
        setSyncNotice(null);
      } else {
        // 无到期词：进入空态，禁止再拉全量 list（会打满后端）
        setDueWords([]);
        setIsFallback(false);
        clearReviewLightCache(vocabZone);
        setSyncNotice(null);
      }
      setCurrentWordIdx(0);
      setSentenceInput('');
      setEvalResult(null);
      setIsFlipped(false);
      setSpellInput('');
    } catch {
      // 保留缓存；无缓存显示明确错误态，绝不回退全量 list/review
      if (!(cached && cached.length > 0)) {
        setDueWords([]);
        setIsFallback(false);
        setSyncNotice('连接失败，请重新加载今日待复习词条。');
      } else {
        setDueWords(cached);
        setSyncNotice(`网络暂不可用，先用上次保存的 ${cached.length} 个复习词。`);
      }
    } finally {
      setLoadingDueWords(false);
      setIsSyncing(false);
    }
  }, [setDueWords, setCurrentWordIdx, setSentenceInput, setLoadingDueWords, vocabZone]);

  useEffect(() => {
    if (activeTab === 'vocab') {
      reloadVocab();
    }
  }, [activeTab, vocabZone, reloadVocab]);

  // 当 theme 改变时，重置当前学习进度，防止因词库过滤导致索引越界
  useEffect(() => {
    setCurrentWordIdx(0);
    setSentenceInput('');
    setEvalResult(null);
    setIsFlipped(false);
    setSpellInput('');
  }, [theme, setCurrentWordIdx, setSentenceInput]);

  // 监听全局 vocab-updated 事件
  useEffect(() => {
    const handleUpdate = () => {
      clearReviewLightCache(vocabZone);
      if (activeTab === 'vocab') {
        reloadVocab();
      }
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [activeTab, reloadVocab, vocabZone]);

  // 接口已按当前分区分页，避免客户端对单页结果二次过滤。
  const filteredWords = dueWords;

  const currentWord = useMemo(() => filteredWords[currentWordIdx], [filteredWords, currentWordIdx]);

  const advanceWord = () => {
    if (currentWordIdx + 1 >= filteredWords.length) {
      void reloadVocab();
      return;
    }
    setCurrentWordIdx((index) => index + 1);
  };

  // 轻量条目按需补全完整 payload
  useEffect(() => {
    const id = currentWord?.id;
    const needsHydrate = Boolean(currentWord?._light);
    if (!id || !needsHydrate) return;
    let cancelled = false;
    getVocabItem(id)
      .then((full) => {
        if (cancelled || !full) return;
        setDueWords((prev) => prev.map((w) => (w.id === id ? { ...full, _light: false } : w)));
      })
      .catch(() => {
        if (cancelled) return;
        setDueWords((prev) => prev.map((word) => (word.id === id ? { ...word, _light: false } : word)));
        showError('词条释义加载失败，可直接翻转查看或稍后重试');
      });
    return () => {
      cancelled = true;
    };
  }, [currentWord?.id, currentWord?._light, setDueWords]);

  const [memoryAidsData, setMemoryAidsData] = useState<MemoryAids | null>(null);

  useEffect(() => {
    if (!currentWord?.id) {
      setMemoryAidsData(null);
      return;
    }
    getMemoryAids(currentWord.id).then(data => setMemoryAidsData(data)).catch(() => setMemoryAidsData(null));
  }, [currentWord?.id]);

  // 适配词典视图所需的 payload 结构
  const adaptedWord = useMemo(() => adaptWordPayload(currentWord), [currentWord]);

  // 提取用于拼写考核的例句及释义
  const spellChallengeData = useMemo(() => {
    if (!currentWord || !adaptedWord || !adaptedWord.payload) return { meaning: '', maskedSentence: '' };
    const p = adaptedWord.payload;
    const meaning = p.meaning_zh
      || p.translation_main
      || p.meaning
      || p.definition
      || (Array.isArray(p.definitions_en) ? p.definitions_en[0] : '')
      || currentWord.payload?.meaning
      || (currentWord._light ? '正在加载释义…' : '暂无释义，可先翻转查看完整词条');
    let example = '';
    if (Array.isArray(p.scenarios) && p.scenarios.length > 0) {
      const scenario = p.scenarios[0];
      example = typeof scenario === 'string' ? scenario : (scenario?.example_en || scenario?.en || scenario?.example || '');
    } else if (Array.isArray(p.example_sentences) && p.example_sentences.length > 0) {
      const sentence = p.example_sentences[0];
      example = typeof sentence === 'string' ? sentence : (sentence?.en || sentence?.example_en || sentence?.example || '');
    }
    const escapedWord = currentWord.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedWord, 'gi');
    const maskedSentence = example ? example.replace(regex, '_________') : '暂无例句，可直接翻转查看词条。';
    return { meaning, maskedSentence };
  }, [currentWord, adaptedWord]);

  const handleSpellCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (spellInput.trim().toLowerCase() === currentWord.word.toLowerCase()) {
         playPageTurn();
         setIsFlipped(true);
      } else {
         playError();
         setIsSpellError(true);
         setTimeout(() => setIsSpellError(false), 500);
      }
    }
  };

  const handleQuality = async (quality: number) => {
    if (!currentWord || submittingQuality) return;
    setSubmittingQuality(true);
    try {
      await submitReview(currentWord.id, quality);
      playSuccess();
      if (quality === 5) setShowConfetti(true);
      window.dispatchEvent(new Event('vocab-updated'));
      showNotice('eval', `已评分 ${quality}/5，进入下一个词`, 'success');
      showSuccess(`复习记录已保存：${currentWord.word}（${quality}/5）`);
      setEvalResult(null);
      setSentenceInput('');
      advanceWord();
      setIsFlipped(false);
      setSpellInput('');
    } catch (err: any) {
      playError();
      console.error('评分保存失败:', err);
      showNotice('eval', '评分保存失败，请稍后重试', 'error');
    } finally {
      setSubmittingQuality(false);
    }
  };

  const handleEvaluate = async () => {
    if (!currentWord || !sentenceInput.trim()) return;
    setIsEvaluating(true);
    setEvalResult(null);
    playScan();
    try {
      const result = await runEnglishSentenceEvaluation(currentWord.word, sentenceInput, theme);
      const quality = Math.max(0, Math.min(5, Math.round(Number(result.score ?? 4))));
      setEvalResult({ feedback: result.feedback, quality });

      if (quality >= 3) {
        setPendingSentenceDebt(null);
        playSuccess();
        if (quality === 5) setShowConfetti(true);
        await submitReview(currentWord.id, quality);
        window.dispatchEvent(new Event('vocab-updated'));
        showNotice('eval', '评估完成，已记入复习进度', 'success');
        showSuccess(`复习记录已保存：${currentWord.word}（${quality}/5）`);
      } else {
        playError();
        void appendErrorLedgerEntries('vocab', [{
          word: currentWord.word,
          score: quality,
          feedback: result.feedback,
          theme,
        }]);
      }
    } catch (err: any) {
      playError();
      console.error('评估失败:', err);
      showNotice('eval', '评估失败，请稍后重试', 'error');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {/* 战术使用指南 Banner */}
      <div className="bg-slate-50 border border-[var(--color-border)] rounded-r-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
           <BookOpen aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-brand)] mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-[var(--color-ink-secondary)] font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与智能整理功能。</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 hover:-translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>阅读左侧整理出的词汇（含发音/例句），在右侧输入框结合当前【战略阶段/主题】强制造句，并提交评估。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 translate-y-1 hover:translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>AI 军控级双重校验（语法精确度 + 商务权力分寸），达到 3 分及格线方可打入 SM-2 记忆算法底座。满分将触发烟花特效。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 -translate-y-0.5 hover:translate-y-[-4px]">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>这里汇总进度总控整理出的词，供口语和写作练习使用。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 双区生词本切换 — 含区别说明 */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center w-full gap-3 flex-wrap">
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              aria-pressed={vocabZone === 'business'}
              onClick={() => { setVocabZone('business'); setCurrentWordIdx(0); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                vocabZone === 'business' ? 'bg-[#202124] text-white shadow-sm' : 'text-gray-500 hover:text-[#202124]'
              }`}
            >
              <Briefcase aria-hidden="true" className="w-3.5 h-3.5" /> 政商务区
            </button>
            <button
              type="button"
              aria-pressed={vocabZone === 'general'}
              onClick={() => { setVocabZone('general'); setCurrentWordIdx(0); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                vocabZone === 'general' ? 'bg-[#202124] text-white shadow-sm' : 'text-gray-500 hover:text-[#202124]'
              }`}
            >
              <Globe aria-hidden="true" className="w-3.5 h-3.5" /> 全场景区
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <VocabExportControl currentTab={vocabZone} />
            <button
              type="button"
              onClick={() => setShowCustomCardModal(true)}
              className="flex items-center gap-1.5 border border-[#FF5722]/30 text-[#FF5722] hover:bg-[#FF5722]/5 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              + 制卡
            </button>
          </div>
        </div>
        {/* 区别说明 */}
        <div className="text-[11px] text-gray-400 leading-relaxed font-medium px-1">
          {vocabZone === 'business' ? (
            <span>
              <span className="font-black text-gray-600 mr-1">💼 政商务区：</span>
              收录由「进度总控」从商务英语长文中整理出的高频词汇与短语（谈判/汇报/危机公关场景专用）。
            </span>
          ) : (
            <span>
              <span className="font-black text-gray-600 mr-1">🌐 全场景区：</span>
              收录精听划线、口语练习中手动标记的词汇（社交/应急/文化破冰通用）。
            </span>
          )}
          <span className="ml-2 text-gray-500">｜ 存量提取词已统一归入政商务区。</span>
        </div>
      </div>

      {/* 主容器：包含复习模式标签与今日词汇展示 */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.015)] flex flex-col items-center justify-center min-h-[400px]">
      {/* 模式标签 */}
      {!loadingDueWords && filteredWords.length > 0 && (
        <div className={`self-stretch flex items-center gap-2 mb-6 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest ${
          isFallback
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {isFallback
            ? <><Library className="w-3.5 h-3.5 shrink-0" /> 全量练习模式 — 今日无到期词，已加载全部词库（{filteredWords.length} 词）供随时练习。复习提交后将更新 SM-2 记忆算法。</>
            : <><CalendarCheck className="w-3.5 h-3.5 shrink-0" /> 今日复习模式 — 第 {currentWordIdx + 1} / {filteredWords.length} 个待复习单词，完成并提交评估将写入 SM-2 周期。{isSyncing ? ' · 同步中…' : ''}</>
          }
        </div>
      )}
      {syncNotice && (
        <div role="status" aria-live="polite" className="self-stretch mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          {syncNotice}
          {syncNotice.startsWith('连接失败') && (
            <button type="button" onClick={reloadVocab} className="ml-3 font-bold underline">重新加载</button>
          )}
        </div>
      )}
      {loadingDueWords ? (
        <div className="text-gray-400 text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 正在检查今日待复习词条…</div>
      ) : !currentWord ? (
        <div className="w-full max-w-2xl text-center py-24">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-[#202124]">今日词汇已清空</h3>
          <p className="text-sm text-gray-500 mt-2">请到「进度总控」生成并整理长文，或休息一下。</p>
        </div>
      ) : (
        <div className="w-full max-w-[96rem] mx-auto space-y-6">

          {/* ================= 上方区域：词汇情报捕获与记忆辅助 ================= */}
          <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-[2.5rem] shadow-sm relative overflow-hidden">
            <div className="bg-white border border-slate-100 rounded-[calc(2.5rem-0.625rem)] p-6 md:p-8 space-y-6">

              {/* 情报卡片标题 */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  {!isFlipped ? (
                    <>
                      <span className="inline-block px-3 py-1 bg-slate-150 text-[#FF5722] text-[10px] font-black uppercase tracking-widest rounded-md border border-slate-200">Target Acquisition</span>
                      <span className="ml-3 text-xs font-black text-gray-500 uppercase tracking-widest">[ {currentWordIdx + 1} / {filteredWords.length} ]</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-250/30">Target Revealed</span>
                      <span className="ml-3 text-lg font-black text-[#FF5722] tracking-wide select-all">{currentWord.word}</span>
                    </>
                  )}
                </div>
                {isFlipped && (
                  <SpeakButton text={currentWord.word} title={`播放 ${currentWord.word}`} className="w-8 h-8 bg-slate-100 text-slate-600 hover:bg-[#FF5722] hover:text-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0" iconClassName="w-4 h-4" />
                )}
              </div>

              {!isFlipped ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-[fadeIn_0.3s_ease-out]">
                  <div className="text-center space-y-4">
                    <h3 className="text-2xl font-black text-[#202124] tracking-wider">{spellChallengeData.meaning}</h3>
                    <p className="text-sm text-gray-500 font-medium max-w-lg mx-auto italic">
                      "{spellChallengeData.maskedSentence}"
                    </p>
                  </div>
                  <div className="w-full max-w-sm relative">
                    <input 
                      id="vocab-spell-input"
                      type="text" 
                      value={spellInput}
                      onChange={(e) => setSpellInput(e.target.value)}
                      onKeyDown={handleSpellCheck}
                      disabled={Boolean(currentWord._light)}
                      aria-label="拼写目标单词"
                      placeholder={currentWord._light ? '正在加载词条释义…' : 'Type the word and press Enter…'}
                      className={`w-full bg-white border-2 rounded-xl px-5 py-4 text-center text-lg font-bold tracking-widest outline-none transition-[border-color,background-color,box-shadow] shadow-inner ${
                        isSpellError ? 'border-red-400 bg-red-50 text-red-600 animate-[shake_0.4s_ease-in-out]' : 'border-slate-200 focus-visible:border-[#FF5722] focus-visible:ring-2 focus-visible:ring-[#FF5722]/20 text-[#202124]'
                      }`}
                      autoFocus
                    />
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center mt-3">
                      Press <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">Enter</span> to check
                    </div>
                    <div className="mt-4 flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          playPageTurn();
                          setIsFlipped(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#202124] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-[#FF5722] transition active:scale-95 shadow-lg shadow-[#202124]/20"
                      >
                        <BookOpen className="w-4 h-4" />
                        不记得了，直接翻转查看答案
                      </button>
                      <span className="text-[10px] text-slate-400">拼不出？点上方按钮跳过拼写，直接进入释义学习</span>
                    </div>
                  </div>

                  {/* 未翻转时亦提供可折叠展开的记忆辅助 */}
                  <div className="w-full border-t border-slate-100 pt-6 mt-6">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5 select-none">
                      <BrainCircuit className="w-4 h-4 text-amber-500" />
                      预看记忆辅助提示 (Memory Aid)
                    </h4>
                    <MemoryAidPanel wordId={currentWord.id} wordText={currentWord.word} />
                  </div>
                </div>
              ) : (
                <div className="animate-[fadeIn_0.4s_ease-out] space-y-6">
                  {/* =================【第 1 行：核心情报 + 记忆辅助工具卡 强水平对齐】================= */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* 左 7 栏：核心词典主卡 */}
                    <div className="lg:col-span-7 flex flex-col">
                      {adaptedWord.type === 'zh_modern' && <ZhModernView payload={adaptedWord.payload} query={currentWord.word} />}
                      {adaptedWord.type === 'en_en_business' && <EnEnBusinessView payload={adaptedWord.payload} query={currentWord.word} />}
                      {adaptedWord.type === 'en_zh_bidirectional' && <EnZhBidirectionalView payload={adaptedWord.payload} query={currentWord.word} />}
                    </div>

                    {/* 右 5 栏：1. 生词记忆辅助 */}
                    <div className="lg:col-span-5 bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 select-none">
                        <BrainCircuit className="w-4 h-4 text-emerald-500 animate-pulse" />
                        1. 生词记忆辅助 (Memory Aids)
                      </h4>
                      <MemoryAidPanel wordId={currentWord.id} wordText={currentWord.word} />
                    </div>
                  </div>

                  {/* =================【第 2 行：圆形记忆矩阵主舞台 + 算法/SOP 仪表盘 强水平对齐】================= */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* 左 7 栏：圆形记忆矩阵主舞台 */}
                    <div className="lg:col-span-7 flex flex-col">
                      <MemoryMatrixStage
                        word={currentWord.word}
                        payload={adaptedWord.payload}
                        memoryAids={memoryAidsData}
                      />
                    </div>

                    {/* 右 5 栏：2. SM-2 算法健康度仪表盘 + 3. 高管商务 SOP */}
                    <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                      {/* 2. SM-2 记忆健康度与衰退曲线仪表盘 */}
                      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4 flex-1">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">2. SM-2 记忆健康度仪表盘</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {currentWord.repetitions >= 3 ? '记忆稳固' : '巩固期'}
                          </span>
                        </div>

                        {/* 记忆留存率进度条 */}
                        <div>
                          <div className="flex justify-between text-[11px] font-bold mb-1.5 text-slate-300">
                            <span>记忆留存率</span>
                            <span className="text-emerald-400 font-mono">
                              {Math.min(99, Math.max(30, 100 - (currentWord.interval_days || 0) * 5 + (currentWord.repetitions || 0) * 10))}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 rounded-full transition-[width] duration-500"
                              style={{ width: `${Math.min(99, Math.max(30, 100 - (currentWord.interval_days || 0) * 5 + (currentWord.repetitions || 0) * 10))}%` }}
                            />
                          </div>
                        </div>

                        {/* 算法三要素卡片 */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">复习轮次</div>
                            <div className="text-sm font-black text-amber-400 mt-0.5">{currentWord.repetitions || 0} 次</div>
                          </div>
                          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">衰退间隔</div>
                            <div className="text-sm font-black text-cyan-400 mt-0.5">{currentWord.interval_days || 0} 天</div>
                          </div>
                          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">难易因子</div>
                            <div className="text-sm font-black text-emerald-400 mt-0.5">{((currentWord.ease_factor || 2500) / 1000).toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                          <span>下次智能排期:</span>
                          <span className="text-slate-200 font-bold">
                            {new Date(currentWord.next_review_date || Date.now()).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>

                      {/* 3. 高管商务语态与实战 SOP */}
                      <div className="bg-amber-50/40 border border-amber-200/70 rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-amber-900 border-b border-amber-200/50 pb-2">
                          <ShieldAlert className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-black uppercase tracking-wider">3. 高管商务语态与分寸 SOP</span>
                        </div>
                        <div className="text-xs text-amber-950/80 leading-relaxed font-medium space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-800 uppercase">语态分寸:</span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                              High Power / 决策级
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-800 uppercase">推荐应用场景:</span>
                            <span className="text-[10px] text-slate-700 font-semibold">QBR 汇报 · 高层谈判 · 战略方案</span>
                          </div>
                          <p className="text-[11px] text-slate-600 italic bg-white/70 p-2.5 rounded-xl border border-amber-100/80 mt-1">
                            💡 提示：在商务汇报中使用此词可显著提升句式的掌控力与专业气场，建议配合下方强制造句提交评估。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= 下方区域：强制闭环造句与评估 ================= */}
          <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-[2.5rem] shadow-sm relative overflow-hidden">
            <div className={`bg-white border border-slate-100 rounded-[calc(2.5rem-0.625rem)] p-6 md:p-8 space-y-6 transition-[opacity,filter,border-color,background-color] ${!isFlipped ? 'opacity-50 pointer-events-none filter blur-[1px]' : ''} ${evalResult ? (evalResult.quality >= 3 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50') : ''}`}>

              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  快捷评分（免造句，直接记入复习进度）
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuality(0)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-[10px] transition-colors disabled:opacity-40 cursor-pointer border border-red-200/40"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>完全忘记</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuality(2)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl font-bold text-[10px] transition-colors disabled:opacity-40 cursor-pointer border border-orange-200/40"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>模糊记得</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuality(4)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-[10px] transition-colors disabled:opacity-40 cursor-pointer border border-blue-200/40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>记住原词</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuality(5)}
                    disabled={submittingQuality}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold text-[10px] transition-colors disabled:opacity-40 cursor-pointer border border-emerald-200/40"
                  >
                    <Zap className="w-4 h-4" />
                    <span>熟练掌握</span>
                  </button>
                </div>
              </div>
              <div className="text-center text-[9px] text-gray-300 font-bold uppercase tracking-widest select-none">
                — OR —
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <label htmlFor="vocab-sentence-input" className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center gap-2">
                  <Zap aria-hidden="true" className="w-5 h-5 text-[#FF5722]" />
                  Forced Application (强制闭环造句)
                </label>
              </div>

              <textarea
                id="vocab-sentence-input"
                rows={4}
                value={sentenceInput}
                onChange={(e) => setSentenceInput(e.target.value)}
                disabled={isEvaluating || (!!evalResult && evalResult.quality >= 3)}
                className="w-full flex-1 min-h-[120px] bg-slate-50 border-2 border-transparent focus-visible:border-[#FF5722] focus-visible:ring-2 focus-visible:ring-[#FF5722]/20 rounded-2xl p-5 text-sm text-[#202124] outline-none resize-none shadow-inner transition-[border-color,box-shadow] disabled:bg-white/50"
                placeholder={`使用 [ ${currentWord.word} ] \n结合当前阵地【${theme}】造句。\n\nAI 教官将实时从「语法精确度」与「商务权力分寸」两方面进行判卷…`}
              />

              {/* 评估结果回显 */}
              {evalResult && (
                <div className="p-6 bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-slate-100 animate-[fadeIn_0.3s_ease-out]">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className={`text-[11px] font-black uppercase tracking-widest ${evalResult.quality >= 3 ? 'text-emerald-500' : 'text-red-500'}`}>
                      AI 教官判卷 (SM-2 权重: {evalResult.quality}/5)
                    </h5>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm ${evalResult.quality >= 3 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {evalResult.quality >= 3 ? 'PASS' : 'REJECT'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line font-medium">{evalResult.feedback}</p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="shrink-0 flex gap-4">
                {!evalResult ? (
                  <button
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !sentenceInput.trim()}
                    className="w-full bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#FF5722] transition-[background-color,box-shadow,transform] disabled:opacity-50 flex justify-center items-center cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] duration-200"
                  >
                    {isEvaluating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 正在评估中…</> : '提交评估并记入复习进度 ➔'}
                  </button>
                ) : evalResult.quality >= 3 ? (
                  <button
                    onClick={() => {
                      setEvalResult(null);
                      setSentenceInput('');
                        advanceWord();
                      setIsFlipped(false);
                      setSpellInput('');
                    }}
                    className="w-full bg-[#FF5722] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-[background-color,box-shadow,transform] cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] duration-200 flex justify-center items-center"
                  >
                    下一个战术目标 (Next Target) ➔
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !sentenceInput.trim()}
                      className="flex-1 bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#303134] transition-colors cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98] flex justify-center items-center"
                    >
                      {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : '修改并重新提交 ↻'}
                    </button>
                    <button
                      onClick={() => {
                        setPendingSentenceDebt(currentWord.word);
                        setEvalResult(null);
                        setSentenceInput('');
                        advanceWord();
                        setIsFlipped(false);
                        setSpellInput('');
                      }}
                      className="px-6 bg-red-50 text-red-500 py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-red-100 transition-colors cursor-pointer border border-red-200 active:scale-[0.98]"
                    >
                      强行跳过
                    </button>
                  </>
                )}
              </div>

              {/* 内联提示（保留原有逻辑） */}
              {inlineNotice && noticeAnchor === 'eval' && (
                <div role="status" aria-live="polite" className={`mt-2 inline-flex rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                  {inlineNotice.text}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      </div>

      {showCustomCardModal && (
        <CustomCardModal
          onClose={() => setShowCustomCardModal(false)}
          onSuccess={async () => {
            setShowCustomCardModal(false);
            clearReviewLightCache(vocabZone);
            await reloadVocab();
          }}
        />
      )}
    </div>
  );
}
