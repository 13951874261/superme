import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, Loader2, CheckCircle2, Zap, Briefcase, Globe, CalendarCheck, Library, BrainCircuit } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { submitReview, getAllWords, getReviewWords } from '../../../../services/vocabAPI';
import { runEnglishSentenceEvaluation } from '../../../../services/difyAPI';
import { appendErrorLedgerEntries } from '../../../../utils/errorLedgerHelper';
import { playSuccess, playError, playScan, playPageTurn } from '../../../../utils/soundEffects';
import CustomCardModal from '../../../CustomCardModal';
import MemoryAidPanel from '../../../MemoryAidPanel';
import VocabExportControl from '../../../VocabExportControl';
import { ZhModernView, EnEnBusinessView, EnZhBidirectionalView } from '../../../DictionaryPanel';

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
  const [onlyCurrentTheme, setOnlyCurrentTheme] = useState(() => {
    return localStorage.getItem('only_current_theme') !== 'false';
  });

  // Anki 闪卡拼写状态
  const [isFlipped, setIsFlipped] = useState(false);
  const [spellInput, setSpellInput] = useState('');
  const [isSpellError, setIsSpellError] = useState(false);

  const reloadVocab = useCallback(async () => {
    setLoadingDueWords(true);
    try {
      const data = await getReviewWords();
      if (Array.isArray(data) && data.length > 0) {
        setDueWords(data);
        setIsFallback(false);
      } else {
        const allData = await getAllWords().catch(() => []);
        setDueWords(allData);
        setIsFallback(true);
      }
      setCurrentWordIdx(0);
      setSentenceInput('');
      setEvalResult(null);
      setIsFlipped(false);
      setSpellInput('');
    } catch {
      const allData = await getAllWords().catch(() => []);
      setDueWords(allData);
      setIsFallback(allData.length > 0);
    } finally {
      setLoadingDueWords(false);
    }
  }, [setDueWords, setCurrentWordIdx, setSentenceInput, setLoadingDueWords]);

  useEffect(() => {
    if (activeTab === 'vocab') {
      reloadVocab();
    }
  }, [activeTab, vocabZone, reloadVocab]);

  // 当切换到 vocab 页面或全局切换 theme 时，默认强制将 onlyCurrentTheme 设为 true
  useEffect(() => {
    if (activeTab === 'vocab') {
      setOnlyCurrentTheme(true);
      localStorage.setItem('only_current_theme', 'true');
    }
  }, [activeTab, theme]);

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
      if (activeTab === 'vocab') {
        reloadVocab();
      }
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [activeTab, reloadVocab]);

  // 双区过滤逻辑：使用 VocabEntry.category 字段（'business' | 'general'）
  // 注意：dict_type 是字典类型（如 en-zh），不是分区标记，不可用于过滤
  // category 默认为 'business'，存量词均在政商务区可见
  // 修复：如果词没有 category 字段（存量数据），两区都可见（保守处理）
  const filteredWords = useMemo(() => {
    return dueWords.filter(w => {
      // 1. 双区过滤
      const cat = w.category;
      let matchesZone = true;
      if (cat) {
        matchesZone = vocabZone === 'business' ? cat === 'business' : cat === 'general';
      }
      if (!matchesZone) return false;

      // 2. 仅限当前主题过滤
      if (onlyCurrentTheme) {
        return w.category === theme || w.payload?.theme === theme;
      }
      return true;
    });
  }, [dueWords, vocabZone, onlyCurrentTheme, theme]);

  const currentWord = useMemo(() => filteredWords[currentWordIdx], [filteredWords, currentWordIdx]);

  // 适配词典视图所需的 payload 结构
  const adaptedWord = useMemo(() => adaptWordPayload(currentWord), [currentWord]);

  // 提取用于拼写考核的例句及释义
  const spellChallengeData = useMemo(() => {
    if (!currentWord || !adaptedWord || !adaptedWord.payload) return { meaning: '', maskedSentence: '' };
    const p = adaptedWord.payload;
    const meaning = p.meaning_zh || currentWord.payload?.meaning || '请根据例句拼写';
    let example = '';
    if (p.scenarios && p.scenarios.length > 0) {
      example = p.scenarios[0].example_en;
    } else if (p.example_sentences && p.example_sentences.length > 0) {
      example = p.example_sentences[0];
    }
    const regex = new RegExp(currentWord.word, 'gi');
    const maskedSentence = example ? example.replace(regex, '_________') : 'No example available.';
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
        showNotice('eval', '评估完成，已写入复习记录', 'success');
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
      showNotice('eval', `评估失败: ${err.message}`, 'error');
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
           <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-brand)] mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-[var(--color-ink-secondary)] font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与AI提纯引擎。</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform hover:-translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>阅读左侧抽取的弹药（含发音/例句），在右侧输入框结合当前【战略阶段/主题】强制造句，并提交评估。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform translate-y-1 hover:translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>AI 军控级双重校验（语法精确度 + 商务权力分寸），达到 3 分及格线方可打入 SM-2 记忆算法底座。满分将触发烟花特效。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>【弹药提纯】上承 Dashboard 的全自动长文提取，下启 Oral/Write，为您在高压沙盘与实战邮件中提供职场黑话储备。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 双区生词本切换 — 含区别说明 */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center w-full gap-3 flex-wrap">
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => { setVocabZone('business'); setCurrentWordIdx(0); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                vocabZone === 'business' ? 'bg-[#202124] text-white shadow-sm' : 'text-gray-500 hover:text-[#202124]'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" /> 政商务区
            </button>
            <button
              onClick={() => { setVocabZone('general'); setCurrentWordIdx(0); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                vocabZone === 'general' ? 'bg-[#202124] text-white shadow-sm' : 'text-gray-500 hover:text-[#202124]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> 全场景区
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <VocabExportControl currentTab={vocabZone} />
            <button
              onClick={() => setShowCustomCardModal(true)}
              className="flex items-center gap-1.5 border border-[#FF5722]/30 text-[#FF5722] hover:bg-[#FF5722]/5 text-xs font-bold px-4 py-2 rounded-xl transition"
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
              收录由「进度总控 → 一键提纯」从商务英语长文中提取的高频词汇与短语（谈判/汇报/危机公关场景专用）。数据来源：Dify 长文提纯 Workflow → 生词本 API（/api/vocab）。
            </span>
          ) : (
            <span>
              <span className="font-black text-gray-600 mr-1">🌐 全场景区：</span>
              收录由「精听盲听 → 划线入库」、口语沙盘截获黑话等日常场景中手动标记的词汇（社交/应急/文化破冰通用）。数据来源：精听划线 + 口语截获 → 生词本 API（/api/vocab）。
            </span>
          )}
          <span className="ml-2 text-gray-500">｜ 无分区标记的存量词两区均可见。</span>
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
            : <><CalendarCheck className="w-3.5 h-3.5 shrink-0" /> 今日复习模式 — {filteredWords.length} 个待复习单词已到期，完成并提交评估将写入 SM-2 周期。</>
          }
        </div>
      )}
      {loadingDueWords ? (
        <div className="text-gray-400 text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 正在检查今日待复习词条...</div>
      ) : !currentWord ? (
        <div className="w-full max-w-2xl text-center py-24">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-[#202124]">今日词汇已清空</h3>
          <p className="text-sm text-gray-500 mt-2">请到“进度总控”执行提纯，或休息一下。</p>
        </div>
      ) : (
        <div className="w-full max-w-4xl mx-auto space-y-6">

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
                      type="text" 
                      value={spellInput}
                      onChange={(e) => setSpellInput(e.target.value)}
                      onKeyDown={handleSpellCheck}
                      placeholder="Type the word and press Enter..."
                      className={`w-full bg-white border-2 rounded-xl px-5 py-4 text-center text-lg font-bold tracking-widest outline-none transition-all shadow-inner ${
                        isSpellError ? 'border-red-400 bg-red-50 text-red-600 animate-[shake_0.4s_ease-in-out]' : 'border-slate-200 focus:border-[#FF5722] text-[#202124]'
                      }`}
                      autoFocus
                    />
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center mt-3">
                      Press <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded">Enter</span> to check
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playPageTurn();
                        setIsFlipped(true);
                      }}
                      className="mt-4 text-xs font-bold text-slate-400 hover:text-[#FF5722] hover:underline transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <span>不记得了，直接翻转查看释义与原词 →</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-[fadeIn_0.4s_ease-out]">
                  {/* 1. 核心词典视图渲染 */}
                  {adaptedWord.type === 'zh_modern' && <ZhModernView payload={adaptedWord.payload} query={currentWord.word} />}
                  {adaptedWord.type === 'en_en_business' && <EnEnBusinessView payload={adaptedWord.payload} query={currentWord.word} />}
                  {adaptedWord.type === 'en_zh_bidirectional' && <EnZhBidirectionalView payload={adaptedWord.payload} query={currentWord.word} />}

                  {/* 2. 生词记忆辅助面板 */}
                  <div className="border-t border-slate-100 pt-6 mt-6">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 select-none">
                      <BrainCircuit className="w-4 h-4 text-emerald-500 animate-pulse" />
                      生词记忆辅助
                    </h4>
                    <MemoryAidPanel wordId={currentWord.id} wordText={currentWord.word} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= 下方区域：强制闭环造句与评估 ================= */}
          <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-[2.5rem] shadow-sm relative overflow-hidden">
            <div className={`bg-white border border-slate-100 rounded-[calc(2.5rem-0.625rem)] p-6 md:p-8 space-y-6 transition-all ${!isFlipped ? 'opacity-50 pointer-events-none filter blur-[1px]' : ''} ${evalResult ? (evalResult.quality >= 3 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50') : ''}`}>

              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FF5722]" />
                  Forced Application (强制闭环造句)
                </label>
              </div>

              <textarea
                rows={4}
                value={sentenceInput}
                onChange={(e) => setSentenceInput(e.target.value)}
                disabled={isEvaluating || (!!evalResult && evalResult.quality >= 3)}
                className="w-full flex-1 min-h-[120px] bg-slate-50 border-2 border-transparent focus:border-[#FF5722] rounded-2xl p-5 text-sm text-[#202124] outline-none resize-none shadow-inner transition-colors disabled:bg-white/50"
                placeholder={`使用 [ ${currentWord.word} ] \n结合当前阵地【${theme}】造句。\n\nAI 教官将实时从「语法精确度」与「商务权力分寸」两方面进行判卷...`}
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
                    className="w-full bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#FF5722] transition-all disabled:opacity-50 flex justify-center items-center cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] duration-200"
                  >
                    {isEvaluating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> AI 军控识别中...</> : '提交评估并推入记忆曲线 ➔'}
                  </button>
                ) : evalResult.quality >= 3 ? (
                  <button
                    onClick={() => {
                      setEvalResult(null);
                      setSentenceInput('');
                      setCurrentWordIdx((p) => p + 1);
                      setIsFlipped(false);
                      setSpellInput('');
                    }}
                    className="w-full bg-[#FF5722] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] duration-200 flex justify-center items-center"
                  >
                    下一个战术目标 (Next Target) ➔
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !sentenceInput.trim()}
                      className="flex-1 bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#303134] transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98] flex justify-center items-center"
                    >
                      {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : '修改并重新提交 ↻'}
                    </button>
                    <button
                      onClick={() => {
                        setPendingSentenceDebt(currentWord.word);
                        setEvalResult(null);
                        setSentenceInput('');
                        setCurrentWordIdx((p) => p + 1);
                        setIsFlipped(false);
                        setSpellInput('');
                      }}
                      className="px-6 bg-red-50 text-red-500 py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-red-100 transition-all cursor-pointer border border-red-200 active:scale-[0.98]"
                    >
                      强行跳过
                    </button>
                  </>
                )}
              </div>

              {/* 内联提示（保留原有逻辑） */}
              {inlineNotice && noticeAnchor === 'eval' && (
                <div className={`mt-2 inline-flex rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
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
            setLoadingDueWords(true);
            try {
              const data = await getReviewWords();
              if (Array.isArray(data) && data.length > 0) {
                setDueWords(data);
                setIsFallback(false);
              } else {
                const allData = await getAllWords().catch(() => []);
                setDueWords(allData);
                setIsFallback(true);
              }
              setCurrentWordIdx(0);
              setSentenceInput('');
              setEvalResult(null);
            } catch (err) {
              console.error(err);
            } finally {
              setLoadingDueWords(false);
            }
          }}
        />
      )}
    </div>
  );
}
