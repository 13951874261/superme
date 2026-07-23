import { useCallback, useEffect, useRef, useState } from 'react';
import { playRecordStart, playRecordStop } from '../../../utils/soundEffects';

const EMPTY_TRANSCRIPT_MESSAGE =
  '未识别到有效语音，请尝试对着麦克风说完整的英文句子，或使用手动输入';

export function useOralRecording(
  isSending: boolean,
  setInputText: (text: string) => void,
  onTranscriptSend: (text: string) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(10);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechChecked, setSpeechChecked] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTextRef = useRef('');

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    playRecordStop();
    recognitionRef.current?.stop();
  }, []);

  const finalizeRecording = useCallback(() => {
    setTimeout(() => {
      const text = pendingTextRef.current.trim();
      if (text) {
        setInputText(text);
        onTranscriptSend(text);
        return;
      }
      setMicError(EMPTY_TRANSCRIPT_MESSAGE);
    }, 550);
  }, [setInputText, onTranscriptSend]);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) {
      setMicError('当前浏览器不支持语音识别，请使用手动输入');
      return;
    }
    if (isSending) {
      setMicError('上一条消息正在发送，请稍候');
      return;
    }
    playRecordStart();
    pendingTextRef.current = '';
    setInputText('');
    setMicError(null);
    setRecordingTime(10);
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch {
      setMicError('无法启动语音识别，请稍后重试或使用手动输入');
      setIsRecording(false);
      return;
    }
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev <= 1) {
          stopRecording();
          finalizeRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isSending, stopRecording, setInputText, finalizeRecording]);

  const stopRecordingAndSend = useCallback(() => {
    stopRecording();
    finalizeRecording();
  }, [stopRecording, finalizeRecording]);

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setSpeechChecked(true);
      return;
    }
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let committed = '';
      let preview = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (result.isFinal) {
          if (alt.confidence > 0.5) {
            committed += alt.transcript;
          }
        } else {
          preview += alt.transcript;
        }
      }
      pendingTextRef.current = committed.trim();
      setInputText((committed + preview).trim());
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      const errMsg = e.error === 'not-allowed'
        ? '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风'
        : e.error === 'no-speech'
          ? '未检测到语音，请确保麦克风正常工作'
          : `语音识别出错: ${e.error}`;
      setMicError(errMsg);
      stopRecording();
    };
    recognitionRef.current = rec;
    setSpeechChecked(true);
  }, [stopRecording, setInputText]);

  const clearPendingText = useCallback(() => {
    pendingTextRef.current = '';
  }, []);

  return {
    isRecording,
    recordingTime,
    speechSupported,
    speechChecked,
    micError,
    startRecording,
    stopRecordingAndSend,
    clearPendingText,
  };
}
