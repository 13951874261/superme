import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Headphones, Loader2, Pause, Play, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { ListeningMaterial, requestListeningTts } from '../services/listeningAPI';

interface BlindListeningCabinProps {
  material: ListeningMaterial | null;
  onRefresh?: () => void;
}

function formatDuration(seconds?: number) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export default function BlindListeningCabin({ material, onRefresh }: BlindListeningCabinProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [notes, setNotes] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ttsMessage, setTtsMessage] = useState('');

  useEffect(() => {
    setShowTranscript(false);
    setShowAnalysis(false);
    setNotes('');
    setIsPlaying(false);
    setTtsStatus('idle');
    setTtsMessage('');
  }, [material?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, material?.audio_url]);

  const hasAudio = Boolean(material?.audio_url);
  const sourceLabel = useMemo(() => {
    if (!material) return '等待材料';
    if (material.source_type === 'crawler') return '爬虫抓取音频';
    if (material.source_type === 'tts') return 'TTS 生成音频';
    return material.source_type || '真实语料';
  }, [material]);

  const handleTogglePlay = async () => {
    if (!audioRef.current || !hasAudio) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
  };

  const handleRequestTts = async () => {
    if (!material) return;
    try {
      setTtsStatus('loading');
      setTtsMessage('');
      const result = await requestListeningTts(material.id, material.source?.voice || 'alloy');
      setTtsStatus(result.pending ? 'idle' : 'done');
      setTtsMessage(result.message || (result.pending ? 'TTS 服务未配置，等待外部音频回填。' : '音频生成完成。'));
      onRefresh?.();
    } catch (error) {
      setTtsStatus('error');
      setTtsMessage(error instanceof Error ? error.message : 'TTS 请求失败');
    }
  };

  if (!material) {
    return (
      <div className="h-full min-h-[520px] rounded-[2rem] bg-white border border-gray-100 flex flex-col items-center justify-center text-gray-300">
        <Headphones className="w-16 h-16 mb-4" strokeWidth={1.5} />
        <p className="text-sm font-bold tracking-widest uppercase">等待执行长破解音频</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-8">
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#1f2023] text-white p-7 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-[#ff6a3d] text-xs font-black tracking-[0.22em] uppercase mb-2">Daily Interception // 截获片段</div>
              <h3 className="text-2xl font-black leading-tight">{material.title}</h3>
            </div>
            <div className="flex flex-col items-end gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 font-black">{material.difficulty}</span>
              <span className="text-white/50">{formatDuration(material.duration)}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-5">
            {hasAudio ? (
              <>
                <audio
                  ref={audioRef}
                  src={material.audio_url}
                  onEnded={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTogglePlay}
                    className="w-12 h-12 rounded-full bg-white text-[#202124] flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1 h-12 flex items-center gap-1 opacity-70">
                    {Array.from({ length: 28 }).map((_, index) => (
                      <span
                        key={index}
                        className="flex-1 rounded-full bg-white/70"
                        style={{ height: `${12 + ((index * 7) % 28)}px` }}
                      />
                    ))}
                  </div>
                  <Volume2 className="w-5 h-5 text-white/60" />
                </div>
              </>
            ) : (
              <div className="min-h-[92px] flex flex-col items-center justify-center text-center gap-3">
                <Headphones className="w-8 h-8 text-white/40" />
                <p className="text-sm text-white/70">暂无真实音频。可触发 TTS，或等待爬虫音频回填。</p>
                <button
                  onClick={handleRequestTts}
                  disabled={ttsStatus === 'loading'}
                  className="px-4 py-2 rounded-full bg-[#ff5722] text-white text-xs font-black hover:bg-[#ff6a3d] disabled:opacity-60"
                >
                  {ttsStatus === 'loading' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> 请求 TTS</span> : '请求 TTS 生成音频'}
                </button>
              </div>
            )}
          </div>

          {ttsMessage && (
            <div className={`mb-5 rounded-2xl px-4 py-3 text-xs ${ttsStatus === 'error' ? 'bg-red-500/15 text-red-100' : 'bg-white/10 text-white/70'}`}>
              {ttsMessage}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <button onClick={() => handleSkip(-3)} disabled={!hasAudio} className="rounded-2xl bg-white/10 py-3 font-bold disabled:opacity-40">退 3 秒</button>
            <button onClick={() => handleSkip(3)} disabled={!hasAudio} className="rounded-2xl bg-white/10 py-3 font-bold disabled:opacity-40">进 3 秒</button>
            {[0.8, 1, 1.2, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`rounded-2xl py-3 font-bold ${playbackRate === rate ? 'bg-[#ff5722]' : 'bg-white/10'}`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-white/60">
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="font-black text-white/40 uppercase tracking-widest mb-1">Category</div>
              {material.category || '未分类'}
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="font-black text-white/40 uppercase tracking-widest mb-1">Source</div>
              {sourceLabel}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-400 font-black tracking-[0.22em] uppercase">Shadowing Dictation // 盲听笔记</div>
              <h4 className="text-xl font-black text-[#202124] mt-1">写下你听到的利益信号</h4>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">Local Draft</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={7}
            className="w-full rounded-3xl bg-[#f8f9fa] border border-gray-100 p-5 text-sm leading-6 outline-none focus:bg-white focus:ring-2 focus:ring-[#ff5722]/20 resize-none"
            placeholder="边听音频，边将你捕捉到的现场要话或英文原文录入此区域。重点标记：真实利益、施压话术、抵押/合规/风险等信号。"
          />
        </section>
      </div>

      <section className="rounded-[2rem] bg-white border border-gray-100 p-7 min-h-[520px]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
          <div>
            <div className="text-xs text-gray-400 font-black tracking-[0.22em] uppercase">Decrypted Intelligence // 盲探解密</div>
            <h4 className="text-2xl font-black text-[#202124] mt-2">原文与潜台词拆解</h4>
          </div>
          <button
            onClick={() => {
              setShowTranscript((v) => !v);
              setShowAnalysis((v) => !v);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#202124] text-white text-xs font-black hover:bg-[#ff5722] transition-colors"
          >
            {showTranscript || showAnalysis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showTranscript || showAnalysis ? '隐藏底牌' : '翻开底牌'}
          </button>
        </div>

        {!showTranscript && !showAnalysis ? (
          <div className="min-h-[360px] flex flex-col items-center justify-center text-center text-gray-300">
            <Headphones className="w-16 h-16 mb-4" strokeWidth={1.5} />
            <p className="text-sm font-bold tracking-widest uppercase">坚持盲听，不要急着看答案</p>
            <p className="text-xs mt-2 max-w-sm leading-6">先听三遍并写下判断，再翻开底牌核对原文、风险暗示与谈判策略。</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl bg-[#f8f9fa] border border-gray-100 p-6">
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <span className="font-black text-[#202124]">Target Transcript // 目标原文</span>
                {showTranscript ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
              </button>
              {showTranscript && <p className="text-base leading-8 text-gray-700 whitespace-pre-wrap font-serif">{material.content_text}</p>}
            </div>

            <div className="rounded-3xl bg-[#fff4ef] border border-[#ffd8c8] p-6">
              <button
                onClick={() => setShowAnalysis((v) => !v)}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <span className="inline-flex items-center gap-2 font-black text-[#c2410c]"><Sparkles className="w-4 h-4" /> Hidden Subtext // 潜台词</span>
                {showAnalysis ? <EyeOff className="w-4 h-4 text-[#c2410c]" /> : <Eye className="w-4 h-4 text-[#c2410c]" />}
              </button>
              {showAnalysis && <p className="text-sm leading-7 text-[#7c2d12] whitespace-pre-wrap">{material.subtext_analysis || '该材料暂无潜台词解析。'}</p>}
            </div>

            <button
              onClick={() => {
                setShowTranscript(false);
                setShowAnalysis(false);
                audioRef.current?.pause();
                if (audioRef.current) audioRef.current.currentTime = 0;
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#f8f9fa] text-gray-600 text-xs font-black hover:bg-gray-100"
            >
              <RotateCcw className="w-4 h-4" /> 重置盲听状态
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
