export type VocabCategory = 'business' | 'general';

export const VOCAB_ZONE_LABEL: Record<VocabCategory, string> = {
  business: '政商务区',
  general: '全场景区',
};

export const VOCAB_ZONE_COLLECT_BTN: Record<VocabCategory, string> = {
  business: '+ 政商务',
  general: '+ 全场景',
};

/** 单个英文单词（与后端 isSingleEnglishWord 对齐） */
export function isSingleEnglishWord(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed || /[\u4e00-\u9fa5]/.test(trimmed)) return false;
  return /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(trimmed);
}

/** 与后端 classifyKind / dict_type 分配对齐 */
/** 仅有释义/音标的悬浮缓存，不能当作 Cambridge/Dify 最终入库结果 */
export function stripThinHoverSeed(payload?: Record<string, any>) {
  if (!payload || typeof payload !== 'object') return undefined;
  const keepKeys = new Set(['source', 'theme', 'topic', 'scene_id', 'scene_title']);
  const extra = Object.keys(payload).filter((key) => {
    const value = payload[key];
    if (value == null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return !keepKeys.has(key) && !['meaning', 'phonetic', 'word', 'meaning_zh', 'translation_main'].includes(key);
  });
  if (extra.length > 0) return payload;
  const keep: Record<string, any> = {};
  for (const key of keepKeys) {
    if (payload[key]) keep[key] = payload[key];
  }
  return Object.keys(keep).length > 0 ? keep : undefined;
}

export function classifyCollectKind(text: string): { isPhrase: boolean; isSentence: boolean } {
  const trimmed = String(text || '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  // 与 vocabMatrixEnricher.classifyKind 对齐：句号结尾即句型
  const isSentence = words.length >= 6 || /[.!?]$/.test(trimmed);
  const isPhrase = !isSentence && words.length >= 2;
  return { isPhrase, isSentence };
}
