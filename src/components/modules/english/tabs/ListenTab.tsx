import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Loader2, PlayCircle, PauseCircle, FastForward, EyeOff, Eye, Target, Zap, AlertTriangle, BookPlus, FileAudio } from 'lucide-react';
import { useEnglishContext } from '../context/EnglishContext';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';
import { runListeningEngine, uploadLocalListeningAudio } from '../../../../services/listeningAPI';
import {
  fetchPregenerated,
  submitPregeneratedBackfill,
  writebackPregenerated,
  type PregenStatus,
} from '../../../../services/listenPregeneratedAPI';
import { appendErrorLedgerEntries } from '../../../../utils/errorLedgerHelper';
import { submitReview, addWord } from '../../../../services/vocabAPI';
import { useTask } from '../../../../components/TaskContext';
import { ListenVoicePicker } from './ListenVoicePicker';
import { fetchListenPrefs, saveListenPrefs } from '../../../../services/listenPrefsAPI';
import { notifyBackgroundHandoff } from '../../../../utils/backgroundHandoff';

const CACHEABLE_DURATIONS = [1, 15, 25, 35];

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
  const [listenDuration, setListenDuration] = useState<number>(1);
  const [isFullscreenText, setIsFullscreenText] = useState(false);
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);
  const [curTtsTaskId, setCurTtsTaskId] = useState<string | null>(null);
  const [curListenTaskId, setCurListenTaskId] = useState<string | null>(null);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [pregenStatus, setPregenStatus] = useState<PregenStatus | null>(null);
  const [pregenArticleStatus, setPregenArticleStatus] = useState<string | null>(null);
  const [pregenAudioStatus, setPregenAudioStatus] = useState<string | null>(null);
  const [isBackfillSubmitting, setIsBackfillSubmitting] = useState(false);
  const [listenMode, setListenMode] = useState<'auto' | 'upload'>('auto');
  const [listenVoiceId, setListenVoiceId] = useState('en-US-BrianNeural');
  const [listenInterruptions, setListenInterruptions] = useState(false);
  const [listenPacketLoss, setListenPacketLoss] = useState(false);
  const [listenInfoGap, setListenInfoGap] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filterFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenEffectsRef = useRef({
    listenVoiceId,
    listenInterruptions,
    listenPacketLoss,
    listenInfoGap,
  });

  useEffect(() => {
    listenEffectsRef.current = {
      listenVoiceId,
      listenInterruptions,
      listenPacketLoss,
      listenInfoGap,
    };
  }, [listenVoiceId, listenInterruptions, listenPacketLoss, listenInfoGap]);

  useEffect(() => {
    void fetchListenPrefs()
      .then((p) => setListenVoiceId(p.effectiveVoiceId || p.voiceId || 'en-US-BrianNeural'))
      .catch(() => { /* keep default */ });
  }, []);

  useEffect(() => {
    if (!isFullscreenText) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreenText(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenText]);

  const handleVoiceChange = (voiceId: string) => {
    setListenVoiceId(voiceId);
    void saveListenPrefs(voiceId).catch(() => {
      showNotice('listen', '音色偏好保存失败，本次仍可使用当前选择的音色', 'error');
    });
  };

  const buildListenTtsEffects = () => {
    const s = listenEffectsRef.current;
    return {
      packet_loss: s.listenPacketLoss,
      interruptions: s.listenInterruptions,
      information_gap: s.listenInfoGap,
    };
  };

  const hasActiveListenEffects = () => {
    const s = listenEffectsRef.current;
    return s.listenPacketLoss || s.listenInterruptions || s.listenInfoGap;
  };


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

  // 接入全局任务中心轮询
  const { tasks, addTask } = useTask();

  const isCacheableDuration = CACHEABLE_DURATIONS.includes(listenDuration);

  const writebackCache = useCallback(async (payload: {
    body?: string;
    audioUrl?: string;
    script?: string;
  }) => {
    if (!CACHEABLE_DURATIONS.includes(listenDuration) || !theme) return;
    try {
      await writebackPregenerated({
        theme,
        genre: listenGenre,
        cefrLevel: listenCefr,
        duration: listenDuration,
        body: payload.body,
        script: payload.script ?? payload.body,
        audioUrl: payload.audioUrl,
      });
    } catch (e) {
      console.warn('[ListenTab] writeback failed', e);
    }
  }, [theme, listenGenre, listenCefr, listenDuration]);

  const submitBackfill = async (
    only: 'both' | 'audio' = 'both',
    anchor?: HTMLElement | null
  ) => {
    if (!theme || isBackfillSubmitting) return;
    setIsBackfillSubmitting(true);
    try {
      const data = await submitPregeneratedBackfill({
        theme,
        genre: listenGenre,
        cefrLevel: listenCefr,
        duration: listenDuration,
        only,
      });
      addTask({
        id: data.taskId,
        type: 'listen_backfill',
        name: `定制听力训练素材生成: ${theme} / ${listenGenre} / ${listenCefr} / ${listenDuration}分钟`,
        status: 'pending',
        progress: 0,
        logs: ['[听力生成] 已提交后台生成队列…'],
      });
      const handoffMsg =
        '听力训练材料正在后台加速生成中，您可以继续进行其他练习，稍后前往【任务中心】查看';
      notifyBackgroundHandoff({
        anchor: anchor || null,
        message: handoffMsg,
        tone: 'info',
      });
      if (!anchor) showNotice('listen', handoffMsg, 'info');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提交后台生成失败';
      showNotice('listen', msg, 'error');
      try {
        const { showToast } = await import('../../../Toast');
        showToast({ message: msg, type: 'error' });
      } catch (err) {}
    } finally {
      setIsBackfillSubmitting(false);
    }
  };

  const applyPregenResult = (data: Awaited<ReturnType<typeof fetchPregenerated>>) => {
    setPregenStatus(data.status);
    setPregenArticleStatus(data.articleStatus || null);
    setPregenAudioStatus(data.audioStatus || null);
    if (data.article?.body) {
      setListenMaterial(data.article.body);
    }
    if (data.audio?.audioUrl) {
      setListenAudioUrl(data.audio.audioUrl);
      setHasPlayed(false);
    }
  };

  const loadFromPregenerateOrRealtime = async (targetTheme: string) => {
    setListenMaterialTheme(targetTheme);
    setListenResult(null);
    setListenInput('');
    setIsTextVisible(false);
    setHasPlayed(false);

    if (!CACHEABLE_DURATIONS.includes(listenDuration)) {
      setPregenStatus('uncached_duration');
      setPregenArticleStatus(null);
      setPregenAudioStatus(null);
      await generateListenMaterial(targetTheme);
      return;
    }

    setIsListenMaterialLoading(true);
    setListenAudioUrl(null);
    setCurTtsTaskId(null);
    setCurListenTaskId(null);
    setIsAudioGenerating(false);

    try {
      const data = await fetchPregenerated({
        theme: targetTheme,
        genre: listenGenre,
        cefrLevel: listenCefr,
        duration: listenDuration,
      });
      applyPregenResult(data);

      if (data.status === 'ready') {
        setIsListenMaterialLoading(false);
        return;
      }
      if (data.status === 'partial' && data.articleStatus === 'ready') {
        setIsListenMaterialLoading(false);
        return;
      }
      if (data.status === 'generating') {
        setIsListenMaterialLoading(false);
        return;
      }
      // missing / failed — show banner, do not auto realtime
      setIsListenMaterialLoading(false);
      if (!data.article?.body) setListenMaterial('');
    } catch (e) {
      console.error('[ListenTab] pregenerate fetch failed', e);
      setPregenStatus('missing');
      setIsListenMaterialLoading(false);
      showNotice('listen', '查找现成听力材料失败，可点击重新生成或稍后重试', 'warning');
    }
  };

  useEffect(() => {
    if (!curTtsTaskId) return;
    const task = tasks.find(t => t.id === curTtsTaskId);
    if (!task) return;
    if (task.status === 'completed' && task.result?.audioUrl) {
      const audioUrl = task.result.audioUrl as string;
      setListenAudioUrl(audioUrl);
      setCurTtsTaskId(null);
      setIsAudioGenerating(false);
      showNotice('listen', '语音已准备好，可以开始听了', 'success');
      setHasPlayed(true);
      void writebackCache(hasActiveListenEffects()
        ? { body: listenMaterial || undefined, script: listenMaterial || undefined }
        : { body: listenMaterial || undefined, audioUrl, script: listenMaterial || undefined });
      setTimeout(() => {
        audioRef.current?.play().catch(() => {
          setHasPlayed(false); // 自动播放被拦截时显示引导闪烁
        });
      }, 100);
    } else if (task.status === 'failed') {
      setCurTtsTaskId(null);
      setIsAudioGenerating(false);
      const errMsg = task.error || '未知错误';
      console.error('音频合成失败:', errMsg);
      showNotice('listen', '高级语音暂时不可用，已改用浏览器朗读，可继续练习', 'error');
    }
  }, [tasks, curTtsTaskId, listenMaterial, writebackCache]);

  // 监听剧本生成任务 (长音频后台机制)
  useEffect(() => {
    if (!curListenTaskId) return;
    const task = tasks.find(t => t.id === curListenTaskId);
    if (!task) return;

    if (task.status === 'completed' && task.result?.content) {
      // 过滤大模型可能返回的中文提示语（如 "📝 沉浸式听力/阅读长篇材料（生成完毕）"）
      const script = task.result.content.replace(/^.*?(📝|生成完毕|沉浸式听力|阅读长篇材料).*?(\n|$)/gm, '').trim();
      setListenMaterial(script);
      setCurListenTaskId(null);
      setIsListenMaterialLoading(false);
      showNotice('listen', '听力文字已生成，正在准备朗读语音…', 'success');
      void writebackCache({ body: script, script });

      // 自动触发 TTS 生成 (选项 A 逻辑)
      setIsAudioGenerating(true);
      import('../../../../services/listeningAPI').then(({ fetchDifyTTS }) => {
        fetchDifyTTS(script, {
          isAsync: true,
          voiceId: listenEffectsRef.current.listenVoiceId,
          effects: buildListenTtsEffects(),
        }).then(ttsRes => {
          if (ttsRes.audioUrl) {
            setListenAudioUrl(ttsRes.audioUrl);
            setIsAudioGenerating(false);
            void writebackCache(hasActiveListenEffects()
              ? { body: script, script }
              : { body: script, script, audioUrl: ttsRes.audioUrl });
          } else if (ttsRes.taskId) {
            addTask({
              id: ttsRes.taskId,
              type: 'tts',
              name: `精听音频: ${listenMaterialTheme}`,
              status: 'pending',
              progress: 0,
              logs: ['音频已提交合成队列…'],
            });
            setCurTtsTaskId(ttsRes.taskId);
          }
        }).catch(audioErr => {
          setIsAudioGenerating(false);
          console.error('音频生成失败', audioErr);
          showNotice('listen', '高级语音暂时不可用，已改用浏览器朗读，可继续练习', 'error');
        });
      });
    } else if (task.status === 'failed') {
      setCurListenTaskId(null);
      setIsListenMaterialLoading(false);
      console.error('剧本生成失败:', task.error);
      showNotice('listen', '听力材料生成失败，请稍后重试', 'error');
    }
  }, [tasks, curListenTaskId, listenMaterialTheme, addTask, setListenMaterial, setIsListenMaterialLoading, showNotice, writebackCache]);

  const generateListenMaterial = async (targetTheme: string) => {
    setIsListenMaterialLoading(true);
    setListenResult(null);
    setListenInput('');
    setIsTextVisible(false);
    setListenAudioUrl(null);
    setCurTtsTaskId(null);
    setCurListenTaskId(null);
    setIsAudioGenerating(false);
    setListenMaterialTheme(targetTheme);
    setHasPlayed(false);

    try {
      const { runListenMaterialGenerator } = await import('../../../../services/difyAPI');
      const res = await runListenMaterialGenerator(targetTheme, listenGenre, listenCefr, listenDuration);
      
      // 若是后台长任务
      if (res && typeof res === 'object' && res.taskId) {
        addTask({
          id: res.taskId,
          type: 'material',
          name: `长听力剧本: ${targetTheme}`,
          status: 'pending',
          progress: 0,
          logs: ['提交剧本生成队列…'],
        });
        setCurListenTaskId(res.taskId);
        showNotice('listen', '听力材料已在后台生成，完成后会自动加载并朗读', 'info');
        // 注意：不在这里 set false，保持 loading 动画直到 useEffect 中检测到 task 完成
        return;
      }

      // 过滤大模型可能返回的中文提示语
      const rawScript = typeof res === 'string' ? res : (res.script || '');
      const script = rawScript.replace(/^.*?(📝|生成完毕|沉浸式听力|阅读长篇材料).*?(\n|$)/gm, '').trim();
      setListenMaterial(script);
      void writebackCache({ body: script, script });

      // 异步音频生成（默认路径，用于短音频）
      const { fetchDifyTTS } = await import('../../../../services/listeningAPI');
      setIsAudioGenerating(true);
      try {
        const ttsRes = await fetchDifyTTS(script, {
          isAsync: true,
          voiceId: listenEffectsRef.current.listenVoiceId,
          effects: buildListenTtsEffects(),
        });
        if (ttsRes.audioUrl) {
          setListenAudioUrl(ttsRes.audioUrl);
          setIsAudioGenerating(false);
          void writebackCache(hasActiveListenEffects()
            ? { body: script, script }
            : { body: script, script, audioUrl: ttsRes.audioUrl });
        } else if (ttsRes.taskId) {
          addTask({
            id: ttsRes.taskId,
            type: 'tts',
            name: `精听音频: ${targetTheme}`,
            status: 'pending',
            progress: 0,
            logs: ['音频已提交合成队列…'],
          });
          setCurTtsTaskId(ttsRes.taskId);
          showNotice('listen', '语音正在后台准备，可继续练习，完成后会自动加载', 'info');
        }
      } catch (audioErr: any) {
        setIsAudioGenerating(false);
        console.error('音频生成失败', audioErr);
        const errCode = audioErr?.code || audioErr?.name;
        if (errCode === 'TTS_GATEWAY_ERROR') {
          showNotice('listen', '高级语音暂时不可用，已改用浏览器朗读，可继续练习', 'error');
        } else if (errCode === 'TTS_LOCKED') {
          showNotice('listen', '当前音频任务已满，请稍后再试', 'warning');
        } else {
          showNotice('listen', '高级语音暂时不可用，已改用浏览器朗读，可继续练习', 'error');
        }
      }
      setIsListenMaterialLoading(false);
    } catch (err) {
      console.error('听力材料生成失败:', err);
      showNotice('listen', '听力材料生成失败，请稍后重试', 'error');
      setIsListenMaterialLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'listen' && listenMaterialTheme !== theme) {
      void loadFromPregenerateOrRealtime(theme);
    }
  }, [activeTab, theme, listenMaterialTheme]);

  // 筛选条件变化时，仅对可缓存时长重新查预生成
  useEffect(() => {
    if (activeTab !== 'listen' || !theme || !listenMaterialTheme) return;
    if (!CACHEABLE_DURATIONS.includes(listenDuration)) {
      setPregenStatus('uncached_duration');
      return;
    }
    if (filterFetchTimer.current) clearTimeout(filterFetchTimer.current);
    filterFetchTimer.current = setTimeout(() => {
      void loadFromPregenerateOrRealtime(theme);
    }, 200);
    return () => {
      if (filterFetchTimer.current) clearTimeout(filterFetchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only refetch on filter dims
  }, [listenGenre, listenCefr, listenDuration, activeTab]);

  useEffect(() => {
    const handler = () => {
      if (activeTab === 'listen' && theme && CACHEABLE_DURATIONS.includes(listenDuration)) {
        void loadFromPregenerateOrRealtime(theme);
      }
    };
    window.addEventListener('listen-pregenerated-ready', handler);
    return () => window.removeEventListener('listen-pregenerated-ready', handler);
  }, [activeTab, theme, listenDuration, listenGenre, listenCefr]);

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showNotice('listen', '音频文件不能超过 50MB', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFileName(file.name);
    setUploadedTranscript('');
    setListenInput('');
    setListenResult(null);

    try {
      const uploadData = await uploadLocalListeningAudio(file, 'default-user');
      if (!uploadData.success) throw new Error((uploadData as any).error || '上传失败');

      setListenAudioUrl(uploadData.audioUrl);
      setUploadProgress(50);
      if (uploadData.transcript) {
        setUploadedTranscript(uploadData.transcript);
        setListenMaterial(uploadData.transcript);
        setUploadProgress(100);
        showNotice('listen', '音频上传及转写成功，请听音频并默写内容', 'info');
      } else {
        setUploadProgress(100);
        showNotice('listen', '音频已上传，但转写失败，可继续手动听写或稍后重试', 'warning');
      }
    } catch (err: any) {
      console.error('音频上传失败:', err);
      showNotice('listen', '上传失败，请稍后重试', 'error');
    } finally {
      setIsUploading(false);
      setIsTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleListenAnalyze = async () => {
    if (!listenInput.trim()) {
      showNotice('listen', '请先在听写区输入你听到的内容', 'error');
      return;
    }
    setIsListenLoading(true);
    try {
      const result = await runListeningEngine(listenInput, listenMaterial, theme);
      setListenResult(result);
      if (result.comparison.errors?.length) {
        void appendErrorLedgerEntries('listening', result.comparison.errors.map((err) => ({
          pattern: err.reason,
          user_heard: err.user_heard,
          actual: err.actual_words,
        })));
      }
    } catch (e) {
      console.error('听写分析失败:', e);
      showNotice('listen', '听写分析失败，请稍后重试', 'error');
    } finally {
      setIsListenLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[85vh] overflow-y-auto pr-2 pb-6 custom-scrollbar scroll-bottom-glow" style={{ scrollbarWidth: 'thin', scrollbarColor: '#FF5722 #f5f5f5' }}>
      <style>{`
        @keyframes slideDownPulse {
          0% { transform: translate(-50%, -10px); opacity: 0; }
          70% { transform: translate(-50%, 2px); }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes softPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255,87,34,0.4)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 8px rgba(255,87,34,0.8)); }
        }
        .animate-soft-pulse {
          animation: softPulse 2s infinite ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-soft-pulse {
            animation: none;
          }
        }
      `}</style>
      <div className="bg-slate-50 border border-[var(--color-border)] rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
           <Headphones className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-brand)] mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-[var(--color-ink-secondary)] font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与AI提纯引擎。</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 transform hover:-translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>盲听截获的高管音频，在下方草稿区速记关键意图。完成后点击「开始分析这段听写」查看听辨误差。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 transform translate-y-1 hover:translate-y-0.5">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>AI 双维解析。不仅比对物理听力误差（Accuracy），更深层扒出讲话者背后的“伪装层”与“权力场”。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-[background-color,transform] duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
              <span className="text-amber-500 mt-0.5"></span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>【听觉撕网】它提取的“截获黑话”将反向丰富您的全局词库，培养在真实高压会议中“听音辨意”的肌肉记忆。</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden shrink-0">
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
                  aria-label="听力题材"
                  className="bg-black/20 text-white/90 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 outline-none focus-visible:border-[#FF5722] focus-visible:bg-black/40 focus-visible:ring-2 focus-visible:ring-[#FF5722]/60 transition-[border-color,background-color,box-shadow] cursor-pointer hover:border-white/20"
                >
                  <option value="meeting" className="text-black">高管会议 (Meeting)</option>
                  <option value="news" className="text-black">财经新闻 (News)</option>
                  <option value="podcast" className="text-black">深度播客 (Podcast)</option>
                </select>
                <select
                  value={listenCefr}
                  onChange={(e) => setListenCefr(e.target.value as any)}
                  aria-label="听力难度"
                  className="bg-black/20 text-white/90 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 outline-none focus-visible:border-[#FF5722] focus-visible:bg-black/40 focus-visible:ring-2 focus-visible:ring-[#FF5722]/60 transition-[border-color,background-color,box-shadow] cursor-pointer hover:border-white/20"
                >
                  <option value="A2" className="text-black">A2 初阶</option>
                  <option value="B1" className="text-black">B1 进阶</option>
                  <option value="B2" className="text-black">B2 高阶</option>
                  <option value="C1" className="text-black">C1 母语级</option>
                </select>
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/10">
                  <span className="text-[10px] text-gray-400 font-black px-1.5">时长:</span>
                  {[1, 15, 25, 35].map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={listenDuration === d}
                      aria-label={`时长 ${d} 分钟`}
                      onClick={() => setListenDuration(d)}
                      className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors cursor-pointer ${
                        listenDuration === d
                          ? 'bg-[#FF5722] text-white shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
<div className="flex items-center gap-2 ml-auto shrink-0">
                  <button
                    type="button"
                    aria-pressed={listenMode === 'auto'}
                    onClick={() => setListenMode('auto')}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-black transition-colors cursor-pointer ${
                      listenMode === 'auto'
                        ? 'bg-[#FF5722] text-white shadow-sm'
                        : 'bg-black/20 text-gray-400 hover:text-white hover:bg-black/40 border border-white/10'
                    }`}
                  >
                    自动生成
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleUploadAudio}
                    className="hidden"
                    id="listen-audio-upload"
                    disabled={isUploading || isTranscribing}
                  />
                  <label
                    htmlFor="listen-audio-upload"
                    onClick={() => setListenMode('upload')}
                    aria-label={listenMode === 'upload' ? '上传音频（当前模式）' : '上传音频'}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-black transition-colors flex items-center gap-1.5 ${
                      isUploading || isTranscribing
                        ? 'bg-[#FF5722] text-white shadow-sm pointer-events-none opacity-70 cursor-wait'
                        : listenMode === 'upload'
                          ? 'bg-[#FF5722] text-white shadow-sm cursor-pointer'
                          : 'bg-black/20 text-gray-400 hover:text-white hover:bg-black/40 border border-white/10 cursor-pointer'
                    }`}
                  >
                    {isUploading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 上传中…</>
                    ) : isTranscribing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 转写中…</>
                    ) : (
                      <>上传音频</>
                    )}
                  </label>
                  {listenMode === 'upload' && uploadedFileName && (
                    <span className="text-[10px] text-white/60 max-w-[180px] truncate" title={uploadedFileName}>
                      {uploadedFileName}
                      {listenAudioUrl ? ' · 已上传' : ''}
                      {uploadedTranscript ? ' · 已转写' : (uploadProgress === 100 ? ' · 转写失败' : '')}
                    </span>
                  )}
                </div>
                {listenMode !== 'upload' && (
                  <button
                    type="button"
                    onClick={() => generateListenMaterial(theme)}
                    disabled={isListenMaterialLoading}
                    className="whitespace-nowrap bg-gradient-to-r from-[#FF5722] to-[#f44336] text-white text-[10px] px-3.5 py-1.5 rounded-lg font-black tracking-widest shadow-md hover:shadow-lg hover:from-[#e64a19] hover:to-[#d32f2f] transition-[box-shadow,opacity,filter] disabled:opacity-50 disabled:grayscale flex items-center gap-1.5"
                  >
                    {isListenMaterialLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在生成…</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5 text-amber-300" /> 生成今日精听</>
                    )}
                  </button>
                )}
              </div>
              {/* 压力因素选择器：仅自动生成模式生效 */}
              {listenMode === 'auto' && (
              <div className="flex flex-wrap items-center gap-3 mt-3 relative z-10 border-t border-white/5 pt-3 w-full">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">压力因素:</span>
                <ListenVoicePicker value={listenVoiceId} onChange={handleVoiceChange} />
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenInterruptions}
                    onChange={(e) => setListenInterruptions(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  故意打断
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenPacketLoss}
                    onChange={(e) => setListenPacketLoss(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  网络卡顿
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={listenInfoGap}
                    onChange={(e) => setListenInfoGap(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/10 bg-black/20 text-[#FF5722] focus:ring-0 focus:ring-offset-0"
                  />
                  白噪丢包
                </label>
              </div>
              )}

              {isCacheableDuration && (pregenStatus === 'missing' || pregenStatus === 'failed') && (
                <div className="relative z-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <p className="text-[11px] text-white/80 flex-1 min-w-[12rem] leading-relaxed">
                    今日该组合内容尚未准备好，可提交后台生成。
                  </p>
                  <button
                    type="button"
                    onClick={(e) => void submitBackfill('both', e.currentTarget)}
                    disabled={isBackfillSubmitting}
                    className="shrink-0 bg-[#FF5722] hover:bg-[#E64A19] text-white text-[10px] font-black px-4 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {isBackfillSubmitting ? '提交中…' : '后台生成'}
                  </button>
                </div>
              )}
              {isCacheableDuration && pregenStatus === 'partial' && pregenArticleStatus === 'ready' && pregenAudioStatus !== 'ready' && (
                <div className="relative z-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <p className="text-[11px] text-white/80 flex-1 min-w-[12rem] leading-relaxed">
                    音频尚未准备好，可单独提交后台生成。
                  </p>
                  <button
                    type="button"
                    onClick={(e) => void submitBackfill('audio', e.currentTarget)}
                    disabled={isBackfillSubmitting}
                    className="shrink-0 bg-[#FF5722] hover:bg-[#E64A19] text-white text-[10px] font-black px-4 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {isBackfillSubmitting ? '提交中…' : '后台生成音频'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4 bg-white/5 p-3 sm:p-4 rounded-2xl mb-6 border border-white/10 relative z-10 w-full overflow-hidden">              {isListenMaterialLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-black uppercase tracking-widest">拦截解码中…</span>
                </div>
              ) : isAudioGenerating ? (
                <div className="flex flex-col gap-3 w-full p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-[#FF5722] animate-spin" />
                      <span className="text-xs font-bold text-gray-200">🎧 核心音频合成中…</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#FF5722] font-bold">
                      {tasks.find(t => t.id === curTtsTaskId)?.progress ?? 0}%
                    </span>
                  </div>
                  
                  {/* 渐变色流式进度条 */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#FF5722] to-[#ff8a65] transition-[width] duration-500 ease-out"
                      style={{ width: `${tasks.find(t => t.id === curTtsTaskId)?.progress ?? 0}%` }}
                    />
                  </div>
                  
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    正在准备朗读语音，可继续看原文或记笔记，准备好后会自动播放。
                  </p>
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
                      onError={() => {
                        setListenAudioUrl(null);
                        setDuration(0);
                        setCurrentTime(0);
                        showNotice('listen', '语音文件异常，已改为逐句朗读', 'warning');
                        void speakEnglish(listenMaterial, playbackRate);
                      }}
                    />
                  )}
                  <button 
                    type="button"
                    aria-label={isPlaying ? '暂停' : '播放截获音频'}
                    onClick={() => {
                      setHasPlayed(true);
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
                    className={`text-white hover:text-[#FF5722] transition-colors cursor-pointer shrink-0 rounded-full duration-300 ${isPlaying ? 'animate-pulse-glow text-[#FF5722]' : (listenAudioUrl && !hasPlayed ? 'animate-soft-pulse text-[#FF5722]' : '')}`} 
                    title={isPlaying ? "暂停" : "播放截获音频"}
                  >
                    {isPlaying ? <PauseCircle className="w-10 h-10" aria-hidden="true" /> : <PlayCircle className="w-10 h-10" aria-hidden="true" />}
                  </button>
                  <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
                    <span className="text-[10px] font-mono w-5 sm:w-6 text-right text-gray-400 shrink-0">{Math.floor(currentTime)}s</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={duration || 100} 
                      value={currentTime}
                      aria-label="播放进度"
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
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
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
                  <button
                    type="button"
                    aria-pressed={isTextVisible}
                    onClick={() => setIsTextVisible(!isTextVisible)}
                    className="flex items-center text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {isTextVisible ? <><EyeOff className="w-3 h-3 mr-1" aria-hidden="true"/> 隐藏 (开启盲听)</> : <><Eye className="w-3 h-3 mr-1" aria-hidden="true"/> 显示文本</>}
                  </button>
                </div>
              </div>
              <div className={`p-4 rounded-xl text-sm font-serif leading-relaxed transition-[background-color,color,filter] duration-300 max-h-[260px] overflow-y-auto custom-scrollbar ${isTextVisible ? 'bg-white/10 text-gray-200 blur-none select-text' : 'bg-black text-white/5 blur-[4px] select-text cursor-text'}`}
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
                {isListenMaterialLoading ? '正在生成敌方动态剧本…' : listenMaterial}
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
                        showNotice('listen', `"${highlightedWord}" 已加入生词本`, 'success');
                        window.dispatchEvent(new Event('vocab-updated'));
                      } catch { showNotice('listen', '加入生词本失败，请稍后重试', 'error'); }
                      finally {
                        setIsAddingHighlight(false);
                        setHighlightedWord('');
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-[#FF5722] text-white text-[10px] font-black uppercase rounded-lg hover:bg-[#e64a19] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isAddingHighlight ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookPlus className="w-3 h-3" />}
                    {isAddingHighlight ? '入库中…' : '划线入库'}
                  </button>
                  <button
                    type="button"
                    aria-label="取消划线"
                    onClick={() => setHighlightedWord('')}
                    className="text-gray-400 hover:text-white text-sm"
                  >×</button>
                </div>
              )}
            </div>
            <div className="relative">
              {inlineNotice && noticeAnchor === 'listen' && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`absolute left-1/2 -translate-x-1/2 -top-5 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border whitespace-nowrap transform -translate-y-2 animate-[slideDownPulse_0.35s_ease-out_forwards] ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-800 text-white border-gray-700'}`}
                >
                  {inlineNotice.text}
                </div>
              )}
              <button 
                onClick={handleListenAnalyze}
                disabled={isListenLoading || listenResult !== null}
                className="w-full relative z-10 bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-lg ripple"
              >
                {isListenLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在解码潜台词…</> : (listenResult ? <span className="flex items-center"><Target className="w-4 h-4 mr-2" /> 潜台词已解码 (见右侧)</span> : <span className="flex items-center"><Zap className="w-4 h-4 mr-2" /> 开始分析这段听写</span>)}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm shrink-0 flex flex-col min-h-[250px]">
            <div className="flex justify-between items-center mb-3">
              <label htmlFor="listen-dictation-input" className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">Shadowing Dictation // 盲打笔记区</label>
              <span className="text-[9px] text-gray-400 font-bold">Local Draft</span>
            </div>
            <textarea 
              id="listen-dictation-input"
              rows={4}
              value={listenInput}
              onChange={(e) => setListenInput(e.target.value)}
              className="w-full bg-[#f8f9fa] border-2 border-transparent focus-visible:border-blue-200 focus-visible:ring-2 focus-visible:ring-blue-200/60 rounded-xl p-4 text-sm text-[#202124] outline-none resize-none flex-1 mb-4 shadow-inner transition-[border-color,box-shadow]"
              placeholder="边听音频，边将您捕捉到的职场黑话或复述文本键入此区域（此区域仅作自我比对草稿，不上传云端）…"
            />
            <button 
              onClick={() => setIsTextVisible(true)}
              className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer ripple"
            >
              <Eye className="w-4 h-4 mr-2" /> 盲打完成，揭晓上方原文进行比对
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Decrypted Intelligence // 情报解密</h4>
            {listenResult && (
              <button 
                onClick={() => generateListenMaterial(theme)}
                disabled={isListenMaterialLoading}
                className="px-4 py-2 bg-[#1a1a1a] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#FF5722] transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center ripple"
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
                         {err.reason}
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
                        <div key={idx} className="bg-[#1a1a1a] rounded-lg p-3 text-white shadow-md">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-xs font-black text-[#FF5722]">{item.word}</div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="划线入库"
                                aria-label={`划线入库：${item.word}`}
                                onClick={async () => {
                                  try {
                                    await addWord({
                                      word: item.word,
                                      dictType: 'listen-jargon',
                                      category: 'general',   // 听力黑话归入「全场景区」
                                      payload: { meaning: item.meaning, source: 'listen_jargon', theme },
                                    });
                                    showNotice('listen', `"${item.word}" 已加入生词本`, 'success');
                                    window.dispatchEvent(new Event('vocab-updated'));
                                  } catch { /* ignore */ }
                                }}
                                className="w-7 h-7 flex items-center justify-center bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-full transition-colors cursor-pointer ripple"
                              >
                                <BookPlus className="w-3.5 h-3.5" aria-hidden="true" />
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label="目标原文全屏"
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overscroll-contain animate-[fadeIn_0.2s_ease-out]"
        >
          <div className="bg-[#1a1b1e] w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h3 className="text-[#FF5722] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Target aria-hidden="true" className="w-4 h-4" /> Target Transcript // 完整情报原文
              </h3>
              <button
                type="button"
                aria-label="关闭全屏原文"
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
