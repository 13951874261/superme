import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, CheckCircle2, Mic, Zap } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { getDueVocabulary } from '../../../../services/difyAPI';
import { submitReview } from '../../../../services/vocabAPI';
import { runEnglishSentenceEvaluation } from '../../../../services/difyAPI';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';

export default function VocabTab() {
  const {
    activeTab,
    theme,
    dueWords, setDueWords,
    currentWordIdx, setCurrentWordIdx,
    sentenceInput, setSentenceInput,
    isEvaluating, setIsEvaluating,
    loadingDueWords, setLoadingDueWords,
    inlineNotice, noticeAnchor, showNotice
  } = useEnglishContext();

  const [evalResult, setEvalResult] = useState<{ quality: number; feedback: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (activeTab !== 'vocab') return;
    setLoadingDueWords(true);
    getDueVocabulary()
      .then((data) => {
        setDueWords(data);
        setCurrentWordIdx(0);
        setSentenceInput('');
        setEvalResult(null);
      })
      .catch(() => setDueWords([]))
      .finally(() => setLoadingDueWords(false));
  }, [activeTab]);

  const currentWord = useMemo(() => dueWords[currentWordIdx], [dueWords, currentWordIdx]);
  const currentWordExample = useMemo(() => (
    currentWord?.payload?.examples?.[0]
    || currentWord?.payload?.related_sentences?.[0]
    || currentWord?.payload?.related_phrases?.[0]
    || ''
  ), [currentWord]);

  const handleEvaluate = async () => {
    if (!currentWord || !sentenceInput.trim()) return;
    setIsEvaluating(true);
    setEvalResult(null);
    playScan();
    try {
      const result = await runEnglishSentenceEvaluation(currentWord.word, sentenceInput);
      const quality = Math.max(0, Math.min(5, Math.round(Number(result.score ?? 4))));
      setEvalResult({ feedback: result.feedback, quality });
      
      if (quality >= 3) {
        playSuccess();
        if (quality === 5) setShowConfetti(true);
        await submitReview(currentWord.id, quality);
        window.dispatchEvent(new Event('vocab-updated'));
        showNotice('eval', '评估完成，已写入复习记录', 'success');
      } else {
        playError();
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
      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-amber-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-amber-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-amber-700 mr-2">操作说明：</span>阅读左侧抽取的弹药（含发音/例句），在右侧输入框结合当前【战略阶段/主题】强制造句，并提交评估。</div>
            <div><span className="font-black text-amber-700 mr-2">功能亮点：</span>AI 军控级双重校验（语法精确度 + 商务权力分寸），达到 3 分及格线方可打入 SM-2 记忆算法底座。满分将触发烟花特效。</div>
            <div><span className="font-black text-amber-700 mr-2">生态定位：</span>【弹药提纯】上承 Dashboard 的全自动长文提取，下启 Oral/Write，为您在高压沙盘与实战邮件中提供职场黑话储备。</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
      {loadingDueWords ? (
        <div className="text-gray-400 text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 拉取今日待复习生词中...</div>
      ) : !currentWord ? (
        <div className="w-full max-w-2xl text-center py-24">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-[#202124]">今日词汇已清空</h3>
          <p className="text-sm text-gray-500 mt-2">请到“进度总控”执行提纯，或休息一下。</p>
        </div>
      ) : (
        <div className="w-full">
          <div className="bg-[#202124] rounded-3xl p-8 mb-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between border border-gray-800 shadow-xl">
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-[#FF5722]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
              <span className="inline-block px-3 py-1 bg-white/10 text-[#FF5722] text-[10px] font-black uppercase tracking-widest rounded-md mb-3 border border-white/5">Target Acquisition</span>
              <span className="ml-3 text-xs font-black text-gray-500 uppercase tracking-widest">[ {currentWordIdx + 1} / {dueWords.length} ]</span>
              <div className="flex items-center md:items-end justify-center md:justify-start gap-4 mb-2">
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight font-serif">{currentWord.word}</h2>
                <SpeakButton text={currentWord.word} title={`播放 ${currentWord.word}`} className="w-10 h-10 bg-white/10 text-white hover:bg-[#FF5722]" iconClassName="w-5 h-5" />
              </div>
              <p className="text-gray-400 font-bold tracking-widest text-lg font-mono">{currentWord.payload?.phonetic || currentWord.payload?.definition_en || ''}</p>
              
              {inlineNotice && noticeAnchor === 'eval' && (
                <div className={`mt-4 inline-flex rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                  {inlineNotice.text}
                </div>
              )}
            </div>
            
            <div className="relative z-10 flex flex-wrap justify-center gap-2">
              <span className="px-4 py-2 bg-white/5 text-gray-300 text-xs font-black uppercase tracking-widest border border-white/10 rounded-xl backdrop-blur-md shadow-sm">{currentWord.payload?.partOfSpeech || currentWord.dict_type || '词条'}</span>
              <span className="px-4 py-2 bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-widest border border-blue-500/20 rounded-xl backdrop-blur-md shadow-sm">商务高频</span>
              <span className="px-4 py-2 bg-[#FF5722]/10 text-[#FF5722] text-xs font-black uppercase tracking-widest border border-[#FF5722]/20 rounded-xl backdrop-blur-md shadow-sm">{theme}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col h-full">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center border-b border-gray-100 pb-3 shrink-0">
                  <BookOpen className="w-4 h-4 mr-2" /> Lexical Analysis (语意识别)
                </h5>
                <div className="text-sm text-gray-700 leading-relaxed font-medium mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100/50">
                  {currentWord.payload?.definition_en || currentWord.payload?.meaning || '暂无释义'}
                </div>
                
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center border-b border-gray-100 pb-3 shrink-0">
                  <Mic className="w-4 h-4 mr-2" /> Context Intercept (语境监听)
                </h5>
                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 relative group transition-all hover:bg-blue-50 flex-1 min-h-[120px]">
                  <div className="absolute top-4 right-4">
                    <SpeakButton text={currentWordExample} title="播放商务例句" className="bg-white text-blue-600 shadow-sm hover:bg-blue-600 hover:text-white" />
                  </div>
                  <p className="text-sm text-blue-900 leading-relaxed italic pr-12 font-medium">
                    "{currentWordExample || '暂无例句'}"
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
              <div className={`flex-1 rounded-3xl p-8 transition-all border-2 flex flex-col ${evalResult ? (evalResult.quality >= 3 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50') : 'border-gray-100 bg-white shadow-sm'}`}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-100/50 pb-4 shrink-0">
                  <label className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-[#FF5722]" /> Forced Application (强制闭环造句)
                  </label>
                </div>
                
                <textarea
                  rows={4}
                  value={sentenceInput}
                  onChange={(e) => setSentenceInput(e.target.value)}
                  disabled={isEvaluating || (!!evalResult && evalResult.quality >= 3)}
                  className="w-full flex-1 min-h-[120px] bg-gray-50 border-2 border-transparent focus:border-[#FF5722] rounded-2xl p-5 text-sm text-[#202124] outline-none resize-none shadow-inner transition-colors disabled:bg-white/50"
                  placeholder={`使用 [ ${currentWord.word} ] \n结合当前阵地【${theme}】造句。\n\nAI 教官将实时从「语法精确度」与「商务权力分寸」两方面进行判卷...`}
                />

                {evalResult && (
                  <div className="mt-6 p-6 bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-gray-100 animate-[fadeIn_0.3s_ease-out]">
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

                <div className="mt-6 shrink-0 flex gap-4">
                  {!evalResult ? (
                    <button
                      onClick={handleEvaluate}
                      disabled={isEvaluating || !sentenceInput.trim()}
                      className="w-full bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#FF5722] transition-all disabled:opacity-50 flex justify-center items-center cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
                    >
                      {isEvaluating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> AI 军控识别中...</> : '提交评估并推入记忆曲线 ➔'}
                    </button>
                  ) : evalResult.quality >= 3 ? (
                    <button
                      onClick={() => {
                        setEvalResult(null);
                        setSentenceInput('');
                        setCurrentWordIdx((p) => p + 1);
                      }}
                      className="w-full bg-[#FF5722] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200 flex justify-center items-center"
                    >
                      下一个战术目标 (Next Target) ➔
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleEvaluate}
                        disabled={isEvaluating || !sentenceInput.trim()}
                        className="flex-1 bg-[#202124] text-white py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#303134] transition-all cursor-pointer shadow-lg hover:shadow-xl flex justify-center items-center"
                      >
                        {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : '修改并重新提交 ↻'}
                      </button>
                      <button
                        onClick={() => {
                          setEvalResult(null);
                          setSentenceInput('');
                          setCurrentWordIdx((p) => p + 1);
                        }}
                        className="px-6 bg-red-50 text-red-500 py-4 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-red-100 transition-all cursor-pointer border border-red-200"
                      >
                        强行跳过
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
