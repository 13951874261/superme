import { useCallback, useEffect, useRef, useState } from 'react';
import { playRecordStart, playRecordStop } from '../../../utils/soundEffects';

export function useOralRecording(
  isSending: boolean,
  setInputText: (text: string) => void,
  onTranscriptSend: (text: string) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(10);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTextRef = useRef('');

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    playRecordStop();
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isSending) return;
    playRecordStart();
    pendingTextRef.current = '';
    setInputText('');
    setRecordingTime(10);
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch { return; }
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev <= 1) {
          stopRecording();
          setTimeout(() => {
            const text = pendingTextRef.current.trim();
            if (text) {
              setInputText(text);
              onTranscriptSend(text);
            }
          }, 550);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isSending, stopRecording, setInputText, onTranscriptSend]);

  const stopRecordingAndSend = useCallback(() => {
    stopRecording();
    setTimeout(() => {
      const text = pendingTextRef.current.trim();
      if (text) {
        setInputText(text);
        onTranscriptSend(text);
      }
    }, 550);
  }, [stopRecording, setInputText, onTranscriptSend]);

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      pendingTextRef.current = transcript;
      setInputText(transcript);
    };
    rec.onerror = () => stopRecording();
    recognitionRef.current = rec;
  }, [stopRecording, setInputText]);

  const clearPendingText = useCallback(() => {
    pendingTextRef.current = '';
  }, []);

  return {
    isRecording,
    recordingTime,
    speechSupported,
    startRecording,
    stopRecordingAndSend,
    clearPendingText,
  };
}
