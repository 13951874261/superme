import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/listeningAPI';

interface Props {
  isProcessing: boolean;
  onSubmit: (text: string) => void;
}

export const BlindListeningCabin: React.FC<Props> = ({ isProcessing, onSubmit }) => {
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');

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
            alert('语音识别失败，请检查网络或麦克风权限。');
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
      alert('无法调用麦克风。');
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Blind Dictation / 盲听区</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] outline-none resize-none transition-all text-sm"
        placeholder="听写内容或记录感悟... (可长按右下角麦克风口述)"
        disabled={isProcessing}
      />
      
      <button
        onMouseDown={handleStartRecord}
        onMouseUp={handleStopRecord}
        onTouchStart={handleStartRecord}
        onTouchEnd={handleStopRecord}
        disabled={isProcessing}
        className={`absolute bottom-10 right-10 p-3.5 rounded-full text-white shadow-md transition-all cursor-pointer ${
          isRecording ? 'bg-[#FF5722] animate-pulse-glow scale-110' : 'bg-gray-800 hover:bg-gray-700 ripple'
        }`}
        title="长按口述录音"
      >
        🎤
      </button>

      <button
        onClick={() => onSubmit(draft)}
        disabled={!draft.trim() || isProcessing}
        className="mt-4 w-full py-3.5 bg-[#FF5722] text-white rounded-xl text-xs font-black tracking-widest uppercase hover:bg-[#e64a19] transition-all disabled:opacity-50 hover:shadow-lg transition-colors ripple cursor-pointer"
      >
        {isProcessing ? 'AI 引擎深度剖析中...' : '提交比对并解锁底牌'}
      </button>
    </div>
  );
};
