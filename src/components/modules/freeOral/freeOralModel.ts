import type { VocabPurifyResult } from '../../../services/difyAPI';

export type FocusCommandResult =
  | { kind: 'message' }
  | { kind: 'focus'; topic: string }
  | { kind: 'invalid'; error: string };

export type CollectCandidate = {
  id: string;
  text: string;
  kind: 'word' | 'phrase' | 'sentence';
  meaning: string;
  phonetic?: string;
  pos?: string;
};

export function extractAssistantText(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const key of ['dialogue', 'answer', 'message']) {
      if (typeof data?.[key] === 'string' && data[key].trim()) return data[key].trim();
    }
  } catch {
    // Dify 也允许直接返回纯文本。
  }
  return text;
}

export function parseFocusCommand(input: string): FocusCommandResult {
  const text = input.trim();
  if (!text.startsWith('/focus')) return { kind: 'message' };
  const match = text.match(/^\/focus(?:\s+(.+))?$/s);
  if (!match) return { kind: 'message' };
  const rawTopic = (match[1] || '').trim();
  if (!rawTopic) return { kind: 'invalid', error: '请输入主题，例如：/focus artificial intelligence' };
  if (/[\u0000-\u001F\u007F]/.test(rawTopic)) return { kind: 'invalid', error: '主题不能包含控制字符' };
  const topic = rawTopic.replace(/\s+/g, ' ');
  if (topic.length > 100) return { kind: 'invalid', error: '主题不能超过 100 个字符' };
  return { kind: 'focus', topic };
}

export function normalizeCollectCandidates(result: VocabPurifyResult): CollectCandidate[] {
  const seen = new Set<string>();
  const output: CollectCandidate[] = [];
  const add = (candidate: Omit<CollectCandidate, 'id'>) => {
    const text = candidate.text.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    output.push({ ...candidate, id: `${candidate.kind}:${key}`, text });
  };

  for (const item of result.words || []) add({
    text: item.word,
    kind: 'word',
    meaning: item.zh_meaning || '',
    ...(item.phonetic ? { phonetic: item.phonetic } : {}),
    ...(item.pos ? { pos: item.pos } : {}),
  });
  for (const item of result.phrases || []) add({ text: item.phrase, kind: 'phrase', meaning: item.meaning || '' });
  for (const text of result.sentences || []) add({ text, kind: 'sentence', meaning: '' });
  return output;
}
