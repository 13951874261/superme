const DEFAULT_VOICE_ID = 'en-GB-LibbyNeural';
const VOICE_STORAGE_KEY = 'super_agent_default_voice';

export function getGlobalVoiceId(): string {
  return localStorage.getItem(VOICE_STORAGE_KEY) || DEFAULT_VOICE_ID;
}

export function buildTtsModel(voiceId?: string): string {
  return `edge-tts/${voiceId ?? getGlobalVoiceId()}`;
}

export interface TtsSpeechOptions {
  model?: string;
  isAsync?: boolean;
  effects?: {
    accent?: 'indian' | 'british' | 'australian' | '';
    packet_loss?: boolean;
    interruptions?: boolean;
    information_gap?: boolean;
  };
}

export interface TtsSpeechResult {
  success?: boolean;
  audioUrl?: string;
  taskId?: string;
  status?: string;
  error?: string;
}

/** 全站唯一 TTS 请求入口：统一走本站 /api/tts/speech */
export async function requestTtsSpeech(
  input: string,
  options: TtsSpeechOptions = {}
): Promise<TtsSpeechResult> {
  try {
    const response = await fetch('/api/tts/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        model: options.model ?? buildTtsModel(),
        ...(options.isAsync !== undefined ? { isAsync: options.isAsync } : {}),
        ...(options.effects !== undefined ? { effects: options.effects } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[ttsAPI] TTS API HTTP error:', response.status, errorData);
      const code = errorData?.code || 'TTS_REQUEST_FAILED';
      const message = errorData?.message || `TTS failed: ${response.status}`;
      const err = new Error(message) as Error & { code?: string };
      err.code = code;
      throw err;
    }

    return response.json();
  } catch (err: any) {
    console.error('[ttsAPI] requestTtsSpeech error:', err);
    throw err;
  }
}
