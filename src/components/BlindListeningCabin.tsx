import React, { useState, useRef } from 'react';
import { transcribeAudio, fetchDifyTTS, pollTtsTask, uploadLocalListeningAudio } from '../services/listeningAPI';

// 简单的 Toast 提示组件
const Toast: React.FC<{ message: string; type: 'error' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => (
  <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs animate-fade-in ${
    type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'
  }`}>
    <div className="flex items-center gap-2">
      <span>{type === 'error' ? '✕' : 'ℹ'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600">✕</button>
    </div>
  </div>
);

interface Props {
  currentSentence?: string; // 当前要盲听且用于生成音频的句子
  onSubmit?: (text: string) => void;
  onTranscriptLoaded?: (transcript: string) => void; // 上传本地音频转录后的回调
}

// 可选的 Edge TTS 语音列表（支持主要国家口音）
const VOICE_OPTIONS = [
  { id: 'en-US-EmmaNeural', label: '美语 (Emma)', accent: 'american' },
  { id: 'en-GB-LibbyNeural', label: '英语 (Libby)', accent: 'british' },
  { id: 'en-IN-NeerjaNeural', label: '印度 (Neerja)', accent: 'indian' },
  { id: 'en-AU-NatashaNeural', label: '澳洲 (Natasha)', accent: 'australian' },
  { id: 'en-GB-RyanNeural', label: '苏格兰 (Ryan)', accent: 'scottish' },
] as const;

export const BlindListeningCabin: React.FC<Props> = ({ currentSentence = '', onSubmit, onTranscriptLoaded }) => {
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);    // 音频播放中
  const [isSynthesizing, setIsSynthesizing] = useState(false); // 合成中
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  
  // 新增压力因子与上传状态
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('en-GB-LibbyNeural');
  const [effects, setEffects] = useState<{
    packet_loss?: boolean;
    interruptions?: boolean;
    information_gap?: boolean;
  }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTranscript, setUploadedTranscript] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'error' | 'info' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  /**
   * 播放按钮：触发 TTS 合成 + 轮询 + 播放
   */
  const handlePlay = async () => {
    if (!currentSentence.trim()) {
      showToast('当前没有可播放的句子内容');
      return;
    }

    if (isPlaying || isSynthesizing) return;

    setIsSynthesizing(true);
    setDraft(''); // 清空听写区，播放后开始听写

    try {
      // Step 1: 请求 TTS（支持选择口音和注入压力因子）
      const ttsResp = await fetchDifyTTS(currentSentence, { 
        isAsync: true,
        voiceId: selectedVoiceId,
        effects: Object.keys(effects).length > 0 ? effects : undefined,
      });

      let audioUrl: string;

      if (ttsResp.audioUrl) {
        audioUrl = ttsResp.audioUrl;
      } else if (ttsResp.taskId) {
        showToast('正在准备练习音频，请稍候…', 'info');
        audioUrl = await pollTtsTask(ttsResp.taskId);
      } else {
        throw new Error(ttsResp.error || '音频生成失败');
      }

      // Step 2: 播放音频
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        showToast('音频播放失败，请稍后重试');
      };

      await audio.play();
      showToast('音频播放中，请盲听并输入内容', 'info');
    } catch (err: any) {
      console.error('[BlindListening] TTS error:', err);
      showToast('音频生成失败，请稍后重试');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadLocalListeningAudio(file, 'local-user');
      if (result.success && result.transcript) {
        setUploadedTranscript(result.transcript);
        if (onTranscriptLoaded) onTranscriptLoaded(result.transcript);
        showToast('原声上传成功，将按录音文字比对', 'info');
      } else {
        showToast('音频已上传，将按题目原文比对', 'info');
      }
    } catch (err: any) {
      console.error('上传失败:', err);
      showToast('上传失败，请稍后重试');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleEffect = (key: keyof typeof effects) => {
    setEffects(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(audioBlob);
          setDraft(prev => (prev ? prev + ' ' + text : text));
        } catch (error) {
          if (recognitionTextRef.current) {
            setDraft(prev => (prev ? prev + ' ' + recognitionTextRef.current : recognitionTextRef.current));
          } else {
            showToast('语音识别失败');
          }
        }
      };
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) { text += event.results[i][0].transcript; }
          recognitionTextRef.current = text.trim();
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
      recorder.start();
      setIsRecording(true);
    } catch (err) { showToast('无法使用麦克风，请检查权限'); }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleSubmit = () => {
    if (draft.trim() && onSubmit) {
      // 如果有上传文本，优先用上传文本做基准，或者由外部自行决定
      onSubmit(draft);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Blind Dictation / 盲听区</h3>

      {/* 压力控制面板 */}
      <div className="flex flex-wrap items-center gap-4 mb-5 pb-5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Voice</label>
          <select 
            className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 outline-none"
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
          >
            {VOICE_OPTIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => toggleEffect('packet_loss')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${effects.packet_loss ? 'bg-amber-100 text-amber-700 font-bold border border-amber-200' : 'bg-gray-50 text-gray-400'}`}>网络卡顿</button>
          <button onClick={() => toggleEffect('interruptions')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${effects.interruptions ? 'bg-red-100 text-red-700 font-bold border border-red-200' : 'bg-gray-50 text-gray-400'}`}>声音打断</button>
          <button onClick={() => toggleEffect('information_gap')} className={`text-[10px] px-2 py-1 rounded-md transition-all ${effects.information_gap ? 'bg-purple-100 text-purple-700 font-bold border border-purple-200' : 'bg-gray-50 text-gray-400'}`}>背景噪音</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handlePlay}
          disabled={!currentSentence.trim() || isPlaying || isSynthesizing}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            isSynthesizing ? 'bg-gray-100 text-gray-400 cursor-wait' :
            isPlaying ? 'bg-[#FF5722] text-white animate-pulse' :
            'bg-[#FF5722] text-white hover:bg-[#e64a19] shadow-md'
          }`}
        >
          {isSynthesizing ? '合成中...' : isPlaying ? '播放中...' : '▶ 盲听'}
        </button>

        <div className="relative flex items-center ml-auto gap-2">
          <input type="file" accept="audio/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100"
          >
            {isUploading ? '转写中...' : '📤 传原声'}
          </button>
          <button
            onMouseDown={handleStartRecord} onMouseUp={handleStopRecord} onTouchStart={handleStartRecord} onTouchEnd={handleStopRecord}
            className={`p-3 rounded-full text-white shadow-md ${isRecording ? 'bg-[#FF5722] animate-pulse scale-110' : 'bg-gray-800'}`}
          >
            🎤
          </button>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#FF5722] outline-none resize-none text-sm"
        placeholder={uploadedTranscript ? "已加载本地原声，请根据听到的内容进行听写..." : "听写内容... (或长按麦克风口述)"}
      />

      <button
        onClick={handleSubmit}
        disabled={!draft.trim() || isSynthesizing}
        className="mt-4 w-full py-3.5 bg-[#FF5722] text-white rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-all disabled:opacity-50"
      >
        提交比对并解锁底牌
      </button>
    </div>
  );
};
