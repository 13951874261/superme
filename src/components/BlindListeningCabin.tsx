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
          console.error(error);
          alert('语音识别失败，请检查网络或麦克风权限。');
        }
      };

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
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
      <h3 className="font-bold text-gray-800 mb-4">Blind Dictation / 盲听区</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-lg focus:ring-1 focus:ring-gray-800 outline-none resize-none transition-all"
        placeholder="听写内容或记录感悟... (可长按右下角麦克风口述)"
        disabled={isProcessing}
      />
      
      <button
        onMouseDown={handleStartRecord}
        onMouseUp={handleStopRecord}
        onTouchStart={handleStartRecord}
        onTouchEnd={handleStopRecord}
        disabled={isProcessing}
        className={`absolute bottom-10 right-10 p-3 rounded-full text-white shadow-md transition-all ${
          isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-gray-800 hover:bg-gray-700'
        }`}
      >
        🎤
      </button>

      <button
        onClick={() => onSubmit(draft)}
        disabled={!draft.trim() || isProcessing}
        className="mt-4 w-full py-3 bg-gray-900 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-black transition-colors"
      >
        {isProcessing ? 'AI 引擎深度剖析中...' : '提交比对并解锁底牌'}
      </button>
    </div>
  );
};
