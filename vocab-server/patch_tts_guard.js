/** 全站唯一 TTS 请求入口：统一走本站 /api/tts/speech */
export async function requestTtsSpeech(
  input: string,
  options: TtsSpeechOptions = {}
): Promise<TtsSpeechResult> {
  // guard clause: 空文本直接返回友好错误，不发请求
  if (!input || typeof input !== 'string' || !input.trim()) {
    const err = new Error('TTS 输入文本不能为空') as Error & { code?: string };
    err.code = 'TTS_EMPTY_INPUT';
    console.warn('[ttsAPI] Empty TTS input, request skipped');
    return { success: false, error: 'TTS 输入文本不能为空' };
  }
  if (input.length > 10000) {
    console.warn('[ttsAPI] Input too long, truncating to 10000 chars');
    input = input.slice(0, 10000);
  }
  try {
