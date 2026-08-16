import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudioWithWhisper } from '../../../services/difyAPI';
import { getAppUserId } from '../../../utils/profileHelper';
import { playRecordStart, playRecordStop } from '../../../utils/soundEffects';

const RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const EMPTY_TRANSCRIPT_MESSAGE = '未识别到有效语音，请尝试对着麦克风说完整的英文句子，或使用手动输入';

export function useMediaRecorder(
  isSending: boolean,
  setInputText: (text: string) => void,
  onTranscriptSend: (text: string) => void,
  maxDurationMs = 30_000,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(
    typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  /** getUserMedia 尚未完成时用户已松开 */
  const startingRef = useRef(false);
  const stopAfterStartRef = useRef(false);

  const releaseResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setRecordingTime(0);
    setIsRecording(false);
  }, []);

  const finishRecording = useCallback(async (chunks: Blob[], mimeType: string) => {
    releaseResources();
    setIsTranscribing(true);
    setMicError(null);
    try {
      if (!chunks.length) {
        setMicError(EMPTY_TRANSCRIPT_MESSAGE);
        return;
      }
      const text = await transcribeAudioWithWhisper(
        new Blob(chunks, { type: mimeType || 'audio/webm' }),
        getAppUserId(),
      );
      if (!text) {
        setMicError(EMPTY_TRANSCRIPT_MESSAGE);
        return;
      }
      setInputText(text);
      onTranscriptSend(text);
    } catch (error) {
      setMicError(error instanceof Error ? error.message : '语音转写失败，请稍后重试');
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscriptSend, releaseResources, setInputText]);

  const stopRecordingAndSend = useCallback(() => {
    // 权限弹窗 / getUserMedia 尚未完成：标记松开，等 start 结束后立刻 stop
    if (startingRef.current) {
      stopAfterStartRef.current = true;
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    playRecordStop();
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || startingRef.current) return;
    if (isSending || isTranscribing) {
      setMicError('上一条消息正在处理，请稍后');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechSupported(false);
      setMicError('当前浏览器不支持麦克风录音，请使用手动输入');
      return;
    }
    startingRef.current = true;
    stopAfterStartRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 用户在等待权限时已松开：释放轨并提示，避免静默空转
      if (stopAfterStartRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        stopAfterStartRef.current = false;
        setMicError(EMPTY_TRANSCRIPT_MESSAGE);
        return;
      }
      const mimeType = RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        void finishRecording(chunks, recorder.mimeType || mimeType);
      };
      recorder.onerror = () => {
        setMicError('录音设备发生错误，请检查麦克风后重试');
        releaseResources();
      };
      recorder.start();
      playRecordStart();
      setInputText('');
      setMicError(null);
      setSpeechSupported(true);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') stopRecordingAndSend();
      }, maxDurationMs);
      if (stopAfterStartRef.current) {
        stopAfterStartRef.current = false;
        stopRecordingAndSend();
      }
    } catch (error) {
      releaseResources();
      setMicError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风'
          : error instanceof Error
            ? error.message
            : '无法访问麦克风，请检查设备权限',
      );
    } finally {
      startingRef.current = false;
    }
  }, [finishRecording, isRecording, isSending, isTranscribing, maxDurationMs, releaseResources, setInputText, stopRecordingAndSend]);

  // 松在按钮外 / 系统抢走焦点时仍结束录音，避免静默悬挂
  useEffect(() => {
    if (!isRecording) return;
    const onGlobalRelease = () => stopRecordingAndSend();
    window.addEventListener('pointerup', onGlobalRelease);
    window.addEventListener('mouseup', onGlobalRelease);
    window.addEventListener('touchend', onGlobalRelease);
    window.addEventListener('blur', onGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', onGlobalRelease);
      window.removeEventListener('mouseup', onGlobalRelease);
      window.removeEventListener('touchend', onGlobalRelease);
      window.removeEventListener('blur', onGlobalRelease);
    };
  }, [isRecording, stopRecordingAndSend]);

  useEffect(() => releaseResources, [releaseResources]);

  return {
    isRecording,
    isTranscribing,
    recordingTime,
    speechSupported,
    speechChecked: true,
    micError,
    startRecording,
    stopRecordingAndSend,
    clearPendingText: () => { chunksRef.current = []; },
  };
}
