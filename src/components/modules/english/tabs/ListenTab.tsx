import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';
import { runListeningEngine, fetchDifyTTS } from '../../../../services/listeningAPI';
import { submitReview, addWord } from '../../../../services/vocabAPI';

export default function ListenTab() {
  const {
    activeTab,
    theme,
    stage,
    listenMaterialTheme, setListenMaterialTheme,
    listenMaterial, setListenMaterial,
    listenAudioUrl, setListenAudioUrl,
    isListenMaterialLoading, setIsListenMaterialLoading,
    isTextVisible, setIsTextVisible,
    isListenLoading, setIsListenLoading,
    listenResult, setListenResult,
    listenInput, setListenInput,
    inlineNotice, noticeAnchor, showNotice
  } = useEnglishContext();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [highlightedWord, setHighlightedWord] = useState('');
  const [listenGenre, setListenGenre] = useState<'news' | 'meeting' | 'podcast'>('meeting');
  const [listenCefr, setListenCefr] = useState<'A2' | 'B1' | 'B2' | 'C1'>('B1');
  const [isFullscreenText, setIsFullscreenText] = useState(false);
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);


  const [globalRateMultiplier, setGlobalRateMultiplier] = useState(
    Number(localStorage.getItem('super_agent_global_rate') || 1.0)
  );

  useEffect(() => {
    const handler = () => {
      setGlobalRateMultiplier(Number(localStorage.getItem('super_agent_global_rate') || 1.0));
    };
    window.addEventListener('global-settings-changed', handler);
    return () => window.removeEventListener('global-settings-changed', handler);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate * globalRateMultiplier;
    }
  }, [playbackRate, globalRateMultiplier]);

  const generateListenMaterial = async (targetTheme: string) => {
    setIsListenMaterialLoading(true);
    setListenResult(null);
    setListenInput('');
    setIsTextVisible(false);
    setListenAudioUrl(null);
    setListenMaterialTheme(targetTheme);
    
    try {
      const { runListenMaterialGenerator } = await import('../../../../services/difyAPI');
      const script = await runListenMaterialGenerator(targetTheme, listenGenre, listenCefr);
      setListenMaterial(script);
      
      try {
        const audioUrl = await fetchDifyTTS(script);
        setListenAudioUrl(audioUrl);
      } catch (audioErr) {
        console.error('音频生成失败，将使用浏览器原生 TTS 兜底', audioErr);
        showNotice('listen', '高保真音频生成失败，将使用原生发音', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotice('listen', '剧本生成失败，请检查配置', 'error');
    } finally {
      setIsListenMaterialLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'listen' && listenMaterialTheme !== theme) {
      void generateListenMaterial(theme);
    }
  }, [activeTab, theme, listenMaterialTheme]);

  const handleListenAnalyze = async () => {
    if (!listenInput.trim()) {
      showNotice('listen', '请先在盲打区输入您的听写记录', 'error');
      return;
    }
    setIsListenLoading(true);
    try {
      const result = await runListeningEngine(listenInput, listenMaterial, theme);
      setListenResult(result);
    } catch (e) {
      showNotice('listen', '听辨解析失败，请检查网络或 API 配置。', 'error');
    } finally {
      setIsListenLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-[650px] h-[85vh]">
      <div className="bg-indigo-50/30 border-l-4 border-indigo-500 rounded-r-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
           <Headphones className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-900 mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-indigo-800/80 font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与AI提纯引擎。</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform hover:-translate-y-0.5">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>盲听截获的高管音频，在下方草稿区速记关键意图。完成后点击“解码潜台词”请求 Dify 分析您的听辨误差。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform translate-y-1 hover:translate-y-0.5">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>AI 双维解析。不仅比对物理听力误差（Accuracy），更深层扒出讲话者背后的“伪装层”与“权力场”。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>【听觉撕网】它提取的“截获黑话”将反向丰富您的全局词库，培养在真实高压会议中“听音辨意”的肌肉记忆。</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto min-h-0 pr-2 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
          <div className="bg-[#202124] rounded-[2rem] p-8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden shrink-0">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF5722]/20 rounded-full blur-3xl"></div>
            <div className="flex flex-col gap-4 mb-6 relative z-10 border-b border-white/10 pb-5">
              <h4 className="text-[13px] font-black uppercase tracking-widest text-[#FF5722] leading-relaxed">
                Daily Interception <br/> 
                <span className="text-[10px] text-white/50">// 截获片段</span>
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={listenGenre}
                  onChange={(e) => setListenGenre(e.target.value as any)}
                  className="bg-black/20 text-white/90 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 outline-none focus:border-[#FF5722] focus:bg-black/40 transition-all cursor-pointer hover:border-white/20"
                >
                  <option value="meeting" className="text-black">高管会议 (Meeting)</option>
                  <option value="news" className="text-black">财经新闻 (News)</option>
                  <option value="podcast" className="text-black">深度播客 (Podcast)</option>
                </select>
                <select
                  value={listenCefr}
                  onChange={(e) => setListenCefr(e.target.value as any)}
                  className="bg-black/20 text-white/90 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 outline-none focus:border-[#FF5722] focus:bg-black/40 transition-all cursor-pointer hover:border-white/20"
                >
                  <option value="A2" className="text-black">A2 初阶</option>
                  <option value="B1" className="text-black">B1 进阶</option>
                  <option value="B2" className="text-black">B2 高阶</option>
                  <option value="C1" className="text-black">C1 母语级</option>
                </select>
                <button
                  onClick={() => generateListenMaterial(theme)}
                  disabled={isListenMaterialLoading}
                  className="ml-auto shrink-0 whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-4 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-all disabled:opacity-50 disabled:grayscale"
                >
                  重新生成
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 bg-white/5 p-3 sm:p-4 rounded-2xl mb-6 border border-white/10 relative z-10 w-full overflow-hidden">
              {isListenMaterialLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-black uppercase tracking-widest">拦截解码中...</span>
                </div>
              ) : (
                <>
                  {listenAudioUrl && (
                    <audio 
                      ref={audioRef} 
                      src={listenAudioUrl} 
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  )}
                  <button 
                    onClick={() => {
                      if (audioRef.current) {
                        if (isPlaying) {
                          audioRef.current.pause();
                        } else {
                          audioRef.current.play().catch(() => speakEnglish(listenMaterial, playbackRate));
                        }
                      } else {
                        speakEnglish(listenMaterial, playbackRate);
                      }
                    }} 
                    className="text-white hover:text-[#FF5722] transition-colors cursor-pointer shrink-0" 
                    title={isPlaying ? "暂停" : "播放截获音频"}
                  >
                    {isPlaying ? <PauseCircle className="w-10 h-10" /> : <PlayCircle className="w-10 h-10" />}
                  </button>
                  <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
                    <span className="text-[10px] font-mono w-5 sm:w-6 text-right text-gray-400 shrink-0">{Math.floor(currentTime)}s</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={duration || 100} 
                      value={currentTime} 
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        setCurrentTime(t);
                        if (audioRef.current) audioRef.current.currentTime = t;
                      }}
                      className="flex-1 min-w-0 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
                    />
                    <span className="text-[10px] font-mono w-5 sm:w-6 text-gray-400 shrink-0">{Math.floor(duration)}s</span>
                  </div>
                  <button 
                    onClick={() => {
                      const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 0.75 : 1;
                      setPlaybackRate(nextRate);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/20 transition-all shrink-0 cursor-pointer"
                    title="调整播放倍速"
                  >
                    <FastForward className="w-3 h-3" /> {(playbackRate * globalRateMultiplier).toFixed(2)}x
                  </button>
                </>
              )}
            </div>
            <div className="relative z-10 mb-6">
              <div className="flex justify-between items-center mb-3 gap-3">
                <span className="text-[10px] uppercase tracking-widest text-gray-400">Target Transcript // 目标原文</span>
                <div className="flex items-center gap-2">
                  <SpeakButton text={listenMaterial} title="播放目标原文" className="bg-white/10 text-white hover:bg-[#FF5722]" />
                  <button onClick={() => setIsFullscreenText(true)} className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer" title="全屏查看原文">
                    <Zap className="w-3 h-3 mr-1"/> 弹窗放大
                  </button>
                  <button onClick={() => setIsTextVisible(!isTextVisible)} className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer">
                    {isTextVisible ? <><EyeOff className="w-3 h-3 mr-1"/> 隐藏 (开启盲听)</> : <><Eye className="w-3 h-3 mr-1"/> 显示文本</>}
                  </button>
                </div>
              </div>
              <div className={`p-4 rounded-xl text-sm font-serif leading-relaxed transition-all duration-300 max-h-[260px] overflow-y-auto ${isTextVisible ? 'bg-white/10 text-gray-200 blur-none select-text' : 'bg-black text-white/5 blur-[4px] select-text cursor-text'}`}
                onMouseUp={() => {
                  const sel = window.getSelection()?.toString().trim();
                  if (sel && sel.split(/\s+/).length <= 5 && isTextVisible) {
                    setHighlightedWord(sel);
                  }
                }}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,0.2) transparent'
                }}
              >
                {isListenMaterialLoading ? '正在生成敌方动态剧本...' : listenMaterial}
              </div>
              {highlightedWord && (
                <div className="mt-2 flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 animate-[fadeIn_0.2s_ease-out]">
                  <span className="text-xs text-[#FF5722] font-black">"{highlightedWord}"</span>
                  <button
                    disabled={isAddingHighlight}
                    onClick={async () => {
                      setIsAddingHighlight(true);
                      try {
                        await addWord({
                          word: highlightedWord,
                          dictType: 'listen-highlight',
                          category: 'general',   // 听力划线词归入「全场景区」
                          payload: { source: 'listen', theme },
                        });
                        showNotice('listen', `"${highlightedWord}" 已划线入库（全场景区）`, 'success');
                        window.dispatchEvent(new Event('vocab-updated'));
                      } catch { showNotice('listen', '入库失败', 'error'); }
                      finally {
                        setIsAddingHighlight(false);
                        setHighlightedWord('');
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-[#FF5722] text-white text-[10px] font-black uppercase rounded-lg hover:bg-[#e64a19] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isAddingHighlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookPlus className="w-3 h-3" />}
                    {isAddingHighlight ? '入库中...' : '划线入库'}
                  </button>
                  <button onClick={() => setHighlightedWord('')} className="text-gray-400 hover:text-white text-sm">×</button>
                </div>
              )}
            </div>
            <div className="relative">
              {inlineNotice && noticeAnchor === 'listen' && (
                <div className={`absolute left-1/2 -translate-x-1/2 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
                  {inlineNotice.text}
                </div>
              )}
              <button 
                onClick={handleListenAnalyze}
                disabled={isListenLoading || listenResult !== null}
                className="w-full relative z-10 bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg"
              >
                {isListenLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在解码潜台词...</> : (listenResult ? '✅ 潜台词已解码 (见右侧)' : '🧠 请求 Dify 侧写此段原文')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm shrink-0 flex flex-col min-h-[250px]">
            <div className="flex justify-between items-center mb-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">Shadowing Dictation // 盲打笔记区</label>
              <span className="text-[9px] text-gray-400 font-bold">Local Draft</span>
            </div>
            <textarea 
              rows={4}
              value={listenInput}
              onChange={(e) => setListenInput(e.target.value)}
              className="w-full bg-[#f8f9fa] border-2 border-transparent focus:border-blue-200 rounded-xl p-4 text-sm text-[#202124] outline-none resize-none flex-1 mb-4 shadow-inner"
              placeholder="边听音频，边将您捕捉到的职场黑话或复述文本键入此区域（此区域仅作自我比对草稿，不上传云端）..."
            />
            <button 
              onClick={() => setIsTextVisible(true)}
              className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer"
            >
              👀 盲打完成，揭晓上方原文进行比对
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm overflow-y-auto">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Decrypted Intelligence // 情报解密</h4>
            {listenResult && (
              <button 
                onClick={() => generateListenMaterial(theme)}
                disabled={isListenMaterialLoading}
                className="px-4 py-2 bg-[#202124] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#FF5722] transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center"
              >
                {isListenMaterialLoading ? <><Loader2 className="w-3 h-3 animate-spin mr-1"/> 扫描中</> : '截获下一段 (Next Interception) ➔'}
              </button>
            )}
          </div>

          {!listenResult ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-4 pt-10">
              <Headphones className="w-16 h-16" />
              <p className="text-xs font-bold tracking-widest uppercase">等待执行声纹解码与差异比对</p>
            </div>
          ) : (
            <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-red-50/50 rounded-2xl p-6 border border-red-100">
                <div className="flex justify-between items-center mb-5">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-red-900 flex items-center">
                    <Target className="w-4 h-4 mr-2" /> Diff Analysis (听力误差)
                  </h5>
                  <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-red-600 shadow-sm border border-red-100">
                    Accuracy: {listenResult.comparison.accuracy_score}
                  </span>
                </div>
                
                <div className="space-y-3 mb-5">
                  {listenResult.comparison.errors.map((err, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-red-50 shadow-sm flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-16">Heard:</span>
                        <span className="text-sm line-through text-red-400">{err.user_heard}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest w-16">Actual:</span>
                        <span className="text-sm font-bold text-emerald-600">{err.actual_words}</span>
                      </div>
                      <div className="mt-2 bg-gray-50 p-2.5 rounded-lg text-xs text-gray-600 font-medium">
                        💡 {err.reason}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm font-medium text-red-800 bg-red-100/50 p-4 rounded-xl border border-red-200/50 italic leading-relaxed">
                  " {listenResult.comparison.coach_comment} "
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 space-y-5">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-blue-900 mb-4 border-b border-blue-200/50 pb-3 flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-blue-600" /> Intelligence Profile (情报侧写)
                </h5>
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">1. Surface Meaning (伪装层)</h5>
                  <div className="bg-white p-4 rounded-xl text-sm text-gray-700 leading-relaxed border border-gray-100 shadow-sm">{listenResult.subtext_analysis.surface_meaning}</div>
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-1" /> 2. Hidden Subtext (真实意图)</h5>
                  <div className="bg-[#FF5722]/5 p-5 rounded-xl text-sm text-[#d84315] leading-relaxed border border-[#FF5722]/20 font-medium shadow-sm">{listenResult.subtext_analysis.hidden_subtext}</div>
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">3. Power Dynamics (权力场)</h5>
                  <div className="bg-white p-4 rounded-xl text-sm text-blue-900 leading-relaxed border border-blue-100 shadow-sm">{listenResult.subtext_analysis.power_dynamics}</div>
                </div>
                {listenResult.subtext_analysis.key_jargons.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">4. Extracted Jargons (截获黑话)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {listenResult.subtext_analysis.key_jargons.map((item, idx) => (
                        <div key={idx} className="bg-[#202124] rounded-lg p-3 text-white shadow-md">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-xs font-black text-[#FF5722]">{item.word}</div>
                            <div className="flex items-center gap-1">
                              <button
                                title="划线入库"
                                onClick={async () => {
                                  try {
                                    await addWord({
                                      word: item.word,
                                      dictType: 'listen-jargon',
                                      category: 'general',   // 听力黑话归入「全场景区」
                                      payload: { meaning: item.meaning, source: 'listen_jargon', theme },
                                    });
                                    showNotice('listen', `"${item.word}" 已入库（全场景区）`, 'success');
                                    window.dispatchEvent(new Event('vocab-updated'));
                                  } catch { /* ignore */ }
                                }}
                                className="w-7 h-7 flex items-center justify-center bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-full transition-colors cursor-pointer"
                              >
                                <BookPlus className="w-3.5 h-3.5" />
                              </button>
                              <SpeakButton text={item.word} title={`播放 ${item.word}`} className="w-7 h-7 bg-white/10 text-white hover:bg-[#FF5722]" iconClassName="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-500">{item.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 原文全屏弹窗 */}
      {isFullscreenText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#1a1b1e] w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h3 className="text-[#FF5722] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Target className="w-4 h-4" /> Target Transcript // 完整情报原文
              </h3>
              <button 
                onClick={() => setIsFullscreenText(false)}
                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-8 overflow-y-auto text-gray-200 text-base font-serif leading-loose"
                 style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,87,34,0.5) transparent' }}
            >
              {listenMaterial}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
