/** 穿透(读)每日推送字数门禁（与 RD-LEN-01 冻结规格一致） */
export const READ_PUSH_MIN_CHARS = 1500;

export function countReadMaterialChars(text: string): number {
  return String(text || '').replace(/\s+/g, '').length;
}

export function evaluateReadPushQuality(text: string): {
  charCount: number;
  quality: 'ok' | 'below_standard';
} {
  const charCount = countReadMaterialChars(text);
  return {
    charCount,
    quality: charCount >= READ_PUSH_MIN_CHARS ? 'ok' : 'below_standard',
  };
}
