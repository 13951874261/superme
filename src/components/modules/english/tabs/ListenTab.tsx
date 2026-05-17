import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';
import { runListeningEngine, fetchDifyTTS } from '../../../../services/listeningAPI';

export default function ListenTab() {
  const {
    activeTab,
    theme,
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
      const script = await runListenMaterialGenerator(targetTheme);
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
      const result = await runListeningEngine(listenInput, listenMaterial);
      setListenResult(result);
    } catch (e) {
      showNotice('listen', '听辨解析失败，请检查网络或 API 配置。', 'error');
    } finally {
      setIsListenLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 min-h-[650px] h-[85vh]">
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-blue-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <Headphones className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-blue-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-blue-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-blue-600 mr-2">操作说明：</span>盲听截获的高管音频，在下方草稿区速记关键意图。完成后点击“解码潜台词”请求 Dify 分析您的听辨误差。</div>
            <div><span className="font-black text-blue-600 mr-2">功能亮点：</span>AI 双维解析。不仅比对物理听力误差（Accuracy），更深层扒出讲话者背后的“伪装层”与“权力场”。</div>
            <div><span className="font-black text-blue-600 mr-2">生态定位：</span>【听觉撕网】它提取的“截获黑话”将反向丰富您的全局词库，培养在真实高压会议中“听音辨意”的肌肉记忆。</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#202124] rounded-[2rem] p-8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden shrink-0">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF5722]/20 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">Daily Interception // 截获片段</h4>
              <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-bold">高管会议盲听</span>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl mb-6 border border-white/10 relative z-10">
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
                  <div className="flex-1 flex items-center gap-3 px-2">
                    <span className="text-[10px] font-mono w-6 text-right text-gray-400">{Math.floor(currentTime)}s</span>
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
                      className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
                    />
                    <span className="text-[10px] font-mono w-6 text-gray-400">{Math.floor(duration)}s</span>
                  </div>
                  <button 
                    onClick={() => {
                      const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 0.75 : 1;
                      setPlaybackRate(nextRate);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase text-gray-300 hover:text-white hover:bg-white/20 transition-all shrink-0 cursor-pointer"
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
                  <button onClick={() => setIsTextVisible(!isTextVisible)} className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer">
                    {isTextVisible ? <><EyeOff className="w-3 h-3 mr-1"/> 隐藏 (开启盲听)</> : <><Eye className="w-3 h-3 mr-1"/> 显示文本</>}
                  </button>
                </div>
              </div>
              <div className={`p-4 rounded-xl text-sm font-serif leading-relaxed transition-all duration-300 ${isTextVisible ? 'bg-white/10 text-gray-200 blur-none select-text' : 'bg-black text-white/5 blur-[4px] select-text cursor-text'}`}>
                {isListenMaterialLoading ? '正在生成敌方动态剧本...' : listenMaterial}
              </div>
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

          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm flex-1 flex flex-col">
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
                            <SpeakButton text={item.word} title={`播放 ${item.word}`} className="w-7 h-7 bg-white/10 text-white hover:bg-[#FF5722]" iconClassName="w-3.5 h-3.5" />
                          </div>
                          <div className="text-[10px] text-gray-300">{item.meaning}</div>
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
    </div>
  );
}
