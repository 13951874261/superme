import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Clock, CheckCircle2, Loader2, Star, Play, Pause, RotateCcw, Lightbulb, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';
import Confetti from '../../../Confetti';
import SpeakButton from '../../../SpeakButton';

const MAX_SECONDS = 1800; // 30分钟上限

interface SpeechPrompterResult {
  outline: {
    opening: string;
    main_points: string[];
    closing: string;
  };
  key_arguments: Array<{ point: string; evidence: string; transition: string }>;
  useful_phrases: {
    openings: string[];
    transitions: string[];
    emphasizing: string[];
    conclusions: string[];
  };
  mindmap: {
    center: string;
    branches: Array<{ title: string; keywords: string[] }>;
  };
  tips: string[];
}

export default function ImpromptuSpeechTab() {
  const { theme, impromptuPassed, setImpromptuPassed, masteryData, showNotice, inlineNotice, noticeAnchor } = useEnglishContext();
  const [isRecording, setIsRecording] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [evaluatingStage, setEvaluatingStage] = useState<'idle' | 'transcribing' | 'evaluating' | 'generating'>('idle');
  const isEvaluating = evaluatingStage !== 'idle';
  const [exemplarText, setExemplarText] = useState('');

  const [evalResult, setEvalResult] = useState<{
    score: number;
    logic: number;
    vocabulary: number;
    fluency: number;
    relevance: number;
    feedback: string;
    structure?: number;
    improvement_suggestions?: string[];
    audio_features?: { estimated_pace: string; estimated_clarity: string; estimated_confidence: string };
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // 音频录制相关
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingPrompter, setIsLoadingPrompter] = useState(false);
  const [showPrompter, setShowPrompter] = useState(false);
  const [prompterResult, setPrompterResult] = useState<SpeechPrompterResult | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualStopRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 音频录制 refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // 自动向下滚动锚定
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // 加载主题提示
  const loadPrompter = async () => {
    if (prompterResult) {
      setShowPrompter(!showPrompter);
      return;
    }
    setIsLoadingPrompter(true);
    try {
      const { runSpeechPrompter } = await import('../../../../services/difyAPI');
      const result = await runSpeechPrompter(theme, '中等');
      setPrompterResult(result);
      setShowPrompter(true);
    } catch (err: any) {
      showNotice('oral', `提示词加载失败: ${err.message}`, 'error');
    } finally {
      setIsLoadingPrompter(false);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      console.warn('音频录制初始化失败:', err);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (!audioPlaybackRef.current) {
      audioPlaybackRef.current = new Audio(audioUrl);
      audioPlaybackRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioPlaybackRef.current.pause();
    } else {
      audioPlaybackRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const resetAudio = () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    setIsPlaying(false);
    setAudioUrl(null);
    setAudioBlob(null);
  };

  const startRecording = (isContinue = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotice('oral', '当前浏览器不支持语音识别（建议使用 Chrome）', 'error');
      return;
    }

    manualStopRef.current = false;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let sessionFinalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) sessionFinalText += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setTranscript(accumulatedTranscriptRef.current + sessionFinalText + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showNotice('oral', `麦克风权限被拒: ${event.error}`, 'error');
        stopRecording();
        return;
      }
      console.warn('Speech API 受到非致命干扰，准备金蝉脱壳重连:', event.error);
    };

    recognition.onstart = () => {
      setIsEngineReady(true);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsed(prev => prev + 1);
        }, 1000);
      }
    };

    recognition.onend = () => {
      accumulatedTranscriptRef.current += sessionFinalText;

      if (!manualStopRef.current && recognitionRef.current === recognition) {
        startRecording(true);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);

    if (!isContinue) {
      setElapsed(0);
      setTranscript('');
      accumulatedTranscriptRef.current = '';
      setEvalResult(null);
      setIsEngineReady(false);
      resetAudio();
      startAudioRecording();
    }
  };

  const stopRecording = () => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    stopAudioRecording();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsEngineReady(false);
  };

  const handleEvaluate = async () => {
    if (elapsed < 180) {
      const remaining = 180 - elapsed;
      const remMin = Math.floor(remaining / 60);
      const remSec = remaining % 60;
      const remStr = remMin > 0 ? `${remMin} 分 ${remSec} 秒` : `${remSec} 秒`;
      showNotice('oral', `演讲时长需达到 3 分钟，还差 ${remStr}，请继续录音`, 'error');
      return;
    }

    let finalTranscript = transcript;
    playScan();

    try {
      const { runImpromptuSpeechEvaluation, transcribeAudioWithWhisper, runSpeechExemplar } = await import('../../../../services/difyAPI');

      // 阶段 1：高精度语音转译
      if (audioBlob) {
        setEvaluatingStage('transcribing');
        try {
          const whisperText = await transcribeAudioWithWhisper(audioBlob);
          if (whisperText) {
            finalTranscript = whisperText;
            setTranscript(whisperText);
          }
        } catch (whisperErr: any) {
          console.error('Whisper 转译失败:', whisperErr);
          if (!finalTranscript.trim()) {
            throw new Error(`语音转译失败且无本地转录文本: ${whisperErr.message}`);
          }
        }
      }

      if (!finalTranscript.trim()) {
        showNotice('oral', '请先完成录音或提供转录文本', 'error');
        return;
      }

      // 阶段 2：AI 评测
      setEvaluatingStage('evaluating');
      const durationStr = `${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒`;
      const res = await runImpromptuSpeechEvaluation(theme, durationStr, finalTranscript);

      const score = Number(res.total_score || 0);
      setEvalResult({
        score,
        logic: Number(res.logic || 0),
        vocabulary: Number(res.vocabulary || 0),
        fluency: Number(res.fluency || 0),
        relevance: Number(res.relevance || 0),
        feedback: String(res.feedback || '')
      });

      // 阶段 3：生成高阶完美示范范文
      setEvaluatingStage('generating');
      try {
        const exemplar = await runSpeechExemplar(theme, finalTranscript);
        setExemplarText(exemplar);
      } catch (exemplarErr: any) {
        console.error('生成演讲范文失败:', exemplarErr);
        showNotice('oral', '评测已完成，但生成演讲范文失败', 'error');
      }

      if (score >= 8) {
        playSuccess();
        setImpromptuPassed(true);
        setShowConfetti(true);
        showNotice('oral', '🎖 即兴演讲达标！通关门槛已解锁', 'success');
      } else {
        playError();
        showNotice('oral', `得分 ${score.toFixed(1)}/10，未达 8 分，请再练习`, 'error');
      }
    } catch (err: any) {
      playError();
      showNotice('oral', `评估失败: ${err.message}`, 'error');
    } finally {
      setEvaluatingStage('idle');
    }
  };

  const handleReset = () => {
    setElapsed(0);
    setTranscript('');
    accumulatedTranscriptRef.current = '';
    setEvalResult(null);
    setExemplarText('');
    setIsEngineReady(false);
    manualStopRef.current = false;
    resetAudio();
  };

  const handleCopyExemplar = async () => {
    if (exemplarText) {
      try {
        await navigator.clipboard.writeText(exemplarText);
        showNotice('oral', '演讲范文已复制到剪贴板', 'success');
        playSuccess();
      } catch (err) {
        playError();
        showNotice('oral', '复制失败', 'error');
      }
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const progress = Math.min(100, (elapsed / MAX_SECONDS) * 100);

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {inlineNotice && noticeAnchor === 'oral' && (
        <div className={`absolute left-1/2 -translate-x-1/2 top-4 z-50 rounded-xl px-5 py-2.5 text-[11px] font-black tracking-widest uppercase shadow-2xl border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}>
          {inlineNotice.text}
        </div>
      )}

      {/* SOP 指南 */}
      <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm">
        <div className="bg-violet-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
          <Mic className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-violet-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-violet-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-violet-600 mr-2">操作说明：</span>点击"开始演讲"，用英语围绕当前主题进行不少于 <strong>3 分钟</strong>的即兴脱稿演讲（硬性门槛）。结束后提交 AI 评测。</div>
            <div><span className="font-black text-violet-600 mr-2">功能亮点：</span>需达到 8/10 分才算通关，从逻辑、词汇、流利度、主题相关性四维综合评判。</div>
            <div><span className="font-black text-violet-600 mr-2">生态定位：</span>【终极评测】弥补短对话无法检验"脱稿长篇演讲"能力的缺口，是通关三大硬性标准之一。</div>
          </div>
        </div>
      </div>

      {/* 通关状态徽章 */}
      {impromptuPassed && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-black text-emerald-900">即兴演讲通关达成</p>
            <p className="text-xs text-emerald-600">当前主题的即兴演讲标准已达成，此项通关指标已解锁。</p>
          </div>
          <Star className="w-5 h-5 text-amber-400 ml-auto" />
        </div>
      )}

      {/* 录音主控区 */}
      <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">当前主题</span>
              <h3 className="text-lg font-black text-white">{theme}</h3>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <div className={`w-2 h-2 rounded-full ${isRecording ? (isEngineReady ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-pulse') : 'bg-gray-400'}`} />
                <span className={`text-xs font-black tracking-widest ${isRecording ? (isEngineReady ? 'text-red-500' : 'text-yellow-500') : 'text-gray-400'}`}>
                  {!isRecording ? 'STANDBY' : (isEngineReady ? 'REC' : 'CONNECTING')}
                </span>
              </div>
              <div className={`text-3xl font-black font-mono tabular-nums ${elapsed >= 180 ? 'text-emerald-400' : elapsed >= 60 ? 'text-amber-400' : 'text-gray-400'}`}>
                {formatTime(elapsed)}
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="w-full h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
            <div
              className="h-2 bg-gradient-to-r from-violet-500 to-[#FF5722] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 实时转录 */}
          {(isRecording || transcript) && (
            <div
              ref={scrollRef}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 min-h-[80px] max-h-[160px] overflow-y-auto scroll-smooth"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">实时转录 (Live Transcript)</span>
              <p className={`text-sm leading-relaxed ${!transcript && isRecording && !isEngineReady ? 'text-yellow-500/80 animate-pulse font-bold' : 'text-gray-200'}`}>
                {transcript || (isRecording ? (isEngineReady ? '🎙️ 正在录音，请开始发言...' : '⏳ 正在打通云端音频流，请稍候...') : '等待您的发言...')}
              </p>
            </div>
          )}

          {/* 音频回放区 */}
          {audioUrl && !isRecording && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">录音回放</span>
                <button
                  onClick={togglePlayback}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? '暂停' : '播放'}
                </button>
                <button
                  onClick={resetAudio}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl text-xs font-black cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  清除
                </button>
              </div>
              <audio ref={audioPlaybackRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex gap-4">
            {!isRecording ? (
              <button
                onClick={() => startRecording(elapsed > 0)}
                disabled={isEvaluating}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg cursor-pointer"
              >
                <Mic className="w-5 h-5" /> {elapsed > 0 ? '继续录音' : '开始演讲'}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg animate-pulse cursor-pointer"
              >
                <MicOff className="w-5 h-5" /> 结束演讲
              </button>
            )}
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || isRecording || (!transcript.trim() && !audioBlob)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#FF5722] hover:bg-[#e64a19] text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg cursor-pointer animate-[all_0.3s_ease]"
            >
              {evaluatingStage !== 'idle' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0 text-white" />
                  <span className="text-[11px] tracking-normal font-black text-white/95 animate-pulse">
                    {evaluatingStage === 'transcribing' && '转译中... (正在通过 Whisper 转译高精度语音文本)'}
                    {evaluatingStage === 'evaluating' && '评测中... (正在调用 AI 评测接口)'}
                    {evaluatingStage === 'generating' && '生成中... (正在为您生成高阶完美示范范文)'}
                  </span>
                </>
              ) : '提交 AI 评测 ➔'}
            </button>
          </div>

          {/* 主题提示按钮 */}
          {!isRecording && !evalResult && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={loadPrompter}
                disabled={isLoadingPrompter}
                className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors text-xs font-black uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {isLoadingPrompter ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4" />
                )}
                {isLoadingPrompter ? '加载提示...' : '演讲提示'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-violet-300 hover:text-white transition-colors text-xs font-black uppercase tracking-widest cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> 重置
              </button>
            </div>
          )}

          {/* 新增：开启下一个演讲 */}
          {!isRecording && evalResult && (
            <div className="mt-4 flex justify-end">
               <button
                 onClick={handleReset}
                 className="flex items-center gap-2 text-violet-300 hover:text-white transition-colors text-xs font-black uppercase tracking-widest cursor-pointer"
               >
                 ↺ 开启新一轮演讲
               </button>
            </div>
          )}
        </div>
      </div>

      {/* 主题提示面板 */}
      {showPrompter && prompterResult && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-[2rem] p-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-amber-800 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              演讲准备提示
            </h4>
            <button
              onClick={() => setShowPrompter(false)}
              className="text-amber-600 hover:text-amber-800 cursor-pointer"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* 思维导图 */}
            <div className="bg-white/60 rounded-2xl p-4 border border-amber-100">
              <h5 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">思维导图</h5>
              <div className="flex flex-wrap gap-2">
                <span className="bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-black">
                  {prompterResult.mindmap.center}
                </span>
                {prompterResult.mindmap.branches.map((branch, i) => (
                  <div key={i} className="flex flex-wrap gap-1 items-center">
                    <span className="text-amber-600">→</span>
                    <div className="flex flex-col gap-1">
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">{branch.title}</span>
                      <div className="flex flex-wrap gap-1">
                        {branch.keywords.map((kw, j) => (
                          <span key={j} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px]">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 演讲结构 */}
            <div className="bg-white/60 rounded-2xl p-4 border border-amber-100">
              <h5 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">演讲结构</h5>
              <div className="space-y-2 text-xs">
                <div><span className="font-black text-amber-600">开场：</span>{prompterResult.outline.opening}</div>
                <div className="ml-4 space-y-1">
                  {prompterResult.outline.main_points.map((p, i) => (
                    <div key={i} className="flex gap-2"><span className="text-amber-400">•</span>{p}</div>
                  ))}
                </div>
                <div><span className="font-black text-amber-600">结尾：</span>{prompterResult.outline.closing}</div>
              </div>
            </div>

            {/* 实用短语 */}
            <div className="bg-white/60 rounded-2xl p-4 border border-amber-100">
              <h5 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">实用短语</h5>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <span className="font-black text-emerald-600 block mb-1">开场</span>
                  {prompterResult.useful_phrases.openings.map((p, i) => (
                    <div key={i} className="text-gray-600 mb-1">{p}</div>
                  ))}
                </div>
                <div>
                  <span className="font-black text-blue-600 block mb-1">过渡</span>
                  {prompterResult.useful_phrases.transitions.map((p, i) => (
                    <div key={i} className="text-gray-600 mb-1">{p}</div>
                  ))}
                </div>
                <div>
                  <span className="font-black text-purple-600 block mb-1">强调</span>
                  {prompterResult.useful_phrases.emphasizing.map((p, i) => (
                    <div key={i} className="text-gray-600 mb-1">{p}</div>
                  ))}
                </div>
                <div>
                  <span className="font-black text-orange-600 block mb-1">结尾</span>
                  {prompterResult.useful_phrases.conclusions.map((p, i) => (
                    <div key={i} className="text-gray-600 mb-1">{p}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* 小贴士 */}
            <div className="bg-amber-100/50 rounded-xl p-3 border border-amber-200">
              <div className="flex gap-2 flex-wrap">
                {prompterResult.tips.map((tip, i) => (
                  <span key={i} className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded-full">💡 {tip}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 评测结果 */}
      {evalResult && (
        <>
          <div className={`rounded-[2rem] p-8 border-2 animate-[fadeIn_0.3s_ease-out] relative overflow-hidden ${evalResult.score >= 8 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h4 className={`text-sm font-black uppercase tracking-widest ${evalResult.score >= 8 ? 'text-emerald-700' : 'text-red-700'}`}>
                AI 四维评测报告
              </h4>
              <div className={`text-4xl font-black ${evalResult.score >= 8 ? 'text-emerald-600' : 'text-red-600'}`}>
                {evalResult.score.toFixed(1)} <span className={`text-xl ${evalResult.score >= 8 ? 'text-emerald-600/50' : 'text-red-600/50'}`}>/ 10</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 维度得分网格 */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                {[
                  { label: 'Logic', title: '逻辑连贯', score: evalResult.logic },
                  { label: 'Vocab', title: '词汇丰富', score: evalResult.vocabulary },
                  { label: 'Fluency', title: '语言流利', score: evalResult.fluency },
                  { label: 'Relevance', title: '主题相关', score: evalResult.relevance }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/60 rounded-2xl p-4 border border-black/5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</div>
                      <div className="text-xs font-bold text-gray-800 mb-2">{item.title}</div>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-2xl font-black text-gray-900 leading-none">{item.score}</span>
                      <span className="text-[10px] text-gray-400 font-bold">/10</span>
                    </div>
                  </div>
                ))}
                {/* 音频特征（如果有） */}
                {evalResult.audio_features && (
                  <div className="col-span-2 bg-amber-50/50 rounded-2xl p-3 border border-amber-200">
                    <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">音频特征</div>
                    <div className="flex gap-3 text-[10px]">
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                        语速: {evalResult.audio_features.estimated_pace}
                      </span>
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                        清晰度: {evalResult.audio_features.estimated_clarity}
                      </span>
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                        自信度: {evalResult.audio_features.estimated_confidence}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 名师点评 */}
              <div className="lg:col-span-7 bg-white/60 rounded-2xl p-6 border border-black/5 shadow-sm flex flex-col">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-gray-800 mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> 名师点评
                </h5>
                <div className="flex-1">
                  <p className="text-[13px] leading-relaxed text-gray-700 font-medium whitespace-pre-line">
                    {evalResult.feedback}
                  </p>
                </div>

                {/* 改进建议 */}
                {evalResult.improvement_suggestions && evalResult.improvement_suggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">改进建议</div>
                    <div className="flex flex-wrap gap-2">
                      {evalResult.improvement_suggestions.map((s, i) => (
                        <span key={i} className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                          → {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evalResult.score < 8 && (
                  <div className="mt-6 inline-flex items-center gap-2 bg-red-100/80 text-red-700 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border border-red-200/50 self-start">
                    ⚠️ 未达标 (8分及格线) — 请重置开启新一轮挑战
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI 高管级完美示范范文 */}
          {exemplarText && (
            <div className="mt-6 bg-white/60 rounded-[2rem] p-8 border border-[#E9D5FF] shadow-sm animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-violet-700">
                  AI 高管级完美示范示范 (Optimized Speech)
                </h4>
                <div className="flex items-center gap-2">
                  <SpeakButton text={exemplarText} title="播放 AI 完美示范示范" />
                  <button
                    onClick={handleCopyExemplar}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all cursor-pointer shadow-sm animate-[all_0.3s_ease]"
                  >
                    <Copy className="w-3.5 h-3.5" /> 复制范文
                  </button>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-gray-700 font-medium whitespace-pre-line italic bg-violet-50/50 p-5 rounded-2xl border border-violet-100">
                {exemplarText}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
