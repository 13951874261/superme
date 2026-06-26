import React, { useState, useRef } from 'react';
import { transcribeAudio, fetchDifyTTS, pollTtsTask } from '../services/listeningAPI';

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
  currentSentence?: string; // 当前要盲听的句子
  onSubmit?: (text: string) => void;
}

export const BlindListeningCabin: React.FC<Props> = ({ currentSentence = '', onSubmit }) => {
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);    // 音频播放中
  const [isSynthesizing, setIsSynthesizing] = useState(false); // 合成中
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      // Step 1: 请求 TTS（同步返回 audioUrl，或返回 taskId 进入异步）
      const ttsResp = await fetchDifyTTS(currentSentence, { isAsync: true });

      let audioUrl: string;

      if (ttsResp.audioUrl) {
        // 同步模式：音频已就绪，直接播放
        audioUrl = ttsResp.audioUrl;
      } else if (ttsResp.taskId) {
        // 异步模式：轮询等待
        showToast('长音频合成中，预计需要数十秒，请耐心等待...', 'info');
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
      showToast('音频播放中，请盲听并在下方输入听到的内容', 'info');
    } catch (err: any) {
      console.error('[BlindListening] TTS error:', err);
      showToast(err.message || '音频生成失败，请稍后重试');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleStartRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(audioBlob);
          setDraft(prev => (prev ? prev + ' ' + text : text));
        } catch (error) {
          console.error('语音转写失败，使用原生 SpeechRecognition 托底:', error);
          const fallbackText = recognitionTextRef.current;
          if (fallbackText) {
            setDraft(prev => (prev ? prev + ' ' + fallbackText : fallbackText));
            console.log('已应用原生语音识别托底内容: ', fallbackText);
          } else {
            showToast('语音识别失败，请检查网络或麦克风权限');
          }
        }
      };

      // 启动浏览器原生 SpeechRecognition 托底
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognitionTextRef.current = '';
        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          recognitionTextRef.current = text.trim();
        };
        recognition.onerror = (err: any) => {
          console.warn('SpeechRecognition error:', err);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      showToast('无法调用麦克风');
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSubmit = () => {
    if (draft.trim() && onSubmit) {
      onSubmit(draft);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      {/* Toast 提示 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Blind Dictation / 盲听区</h3>

      {/* 顶部操作栏：播放 + 录音 */}
      <div className="flex items-center gap-3 mb-4">
        {/* 盲听播放按钮 */}
        <button
          onClick={handlePlay}
          disabled={!currentSentence.trim() || isPlaying || isSynthesizing}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            isSynthesizing
              ? 'bg-gray-100 text-gray-400 cursor-wait'
              : isPlaying
              ? 'bg-[#FF5722] text-white cursor-pointer animate-pulse'
              : currentSentence.trim()
              ? 'bg-[#FF5722] text-white hover:bg-[#e64a19] shadow-md hover:shadow-lg cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          title={isSynthesizing ? '音频合成中...' : isPlaying ? '播放中...' : '点击播放盲听音频'}
        >
          {isSynthesizing ? (
            <>
              <span className="animate-spin">⟳</span>
              <span>合成中...</span>
            </>
          ) : isPlaying ? (
            <>
              <span>🔊</span>
              <span>播放中...</span>
            </>
          ) : (
            <>
              <span>▶</span>
              <span>盲听</span>
            </>
          )}
        </button>

        {/* 提示文字 */}
        {currentSentence.trim() && !isSynthesizing && !isPlaying && (
          <span className="text-xs text-gray-400">
            生成 15~30 分钟音频可能需要数秒到数十秒，请耐心等待
          </span>
        )}

        {/* 麦克风按钮 */}
        <button
          onMouseDown={handleStartRecord}
          onMouseUp={handleStopRecord}
          onTouchStart={handleStartRecord}
          onTouchEnd={handleStopRecord}
          disabled={isSynthesizing}
          className={`ml-auto p-3.5 rounded-full text-white shadow-md transition-all cursor-pointer ${
            isRecording ? 'bg-[#FF5722] animate-pulse-glow scale-110' : 'bg-gray-800 hover:bg-gray-700'
          } ${isSynthesizing ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="长按口述录音"
        >
          🎤
        </button>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] outline-none resize-none transition-all text-sm"
        placeholder="听写内容或记录感悟... (可长按右下角麦克风口述)"
        disabled={isSynthesizing}
      />

      <button
        onClick={handleSubmit}
        disabled={!draft.trim() || isSynthesizing}
        className="mt-4 w-full py-3.5 bg-[#FF5722] text-white rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-all disabled:opacity-50 hover:shadow-lg transition-colors ripple cursor-pointer"
      >
        {isSynthesizing ? '音频合成中，请稍后...' : '提交比对并解锁底牌'}
      </button>
    </div>
  );
};
