import { useMediaRecorder } from './useMediaRecorder';

export function useOralRecording(
  isSending: boolean,
  setInputText: (text: string) => void,
  onTranscriptSend: (text: string) => void,
) {
  return useMediaRecorder(isSending, setInputText, onTranscriptSend);
}
