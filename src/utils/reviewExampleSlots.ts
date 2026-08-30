/** 生词复习 / 词典展示共用的例句抽取（无 React 依赖） */

export type ReviewExample = { en: string; zh: string };

function englishLetterCount(value: string): number {
  return (String(value || '').match(/[A-Za-z]/g) || []).length;
}

function isPhoneticBlockedExample(value: string): boolean {
  const en = String(value || '').trim();
  if (!en) return true;
  if (/^\/[^/\n]+\/(?:\s*(?:us|uk))?$/i.test(en)) return true;
  if (/\/[^/\s\n]{2,80}\//.test(en)) return true;
  return false;
}

export function isAdmissibleDisplayExample(en: string): boolean {
  const text = String(en || '').trim();
  if (!text) return false;
  if (isPhoneticBlockedExample(text)) return false;
  return englishLetterCount(text) > 25;
}

function normalizeExamplePair(ex: any): ReviewExample | null {
  if (typeof ex === 'string') {
    const en = ex.trim();
    if (!en) return null;
    return { en, zh: '' };
  }
  if (ex && typeof ex === 'object') {
    const en = String(ex.en || ex.example_en || ex.sentence || ex.example || '').trim();
    const zh = String(ex.zh || ex.translation || ex.example_zh || '').trim();
    if (!en && !zh) return null;
    return { en, zh };
  }
  return null;
}

/** 英汉双向展示例句：单词优先 senses；否则 example_sentences */
export function extractCambridgeDisplayExamples(payload: Record<string, any> | null | undefined): ReviewExample[] {
  const p = payload && typeof payload === 'object' ? payload : {};
  const senseExamples = Array.isArray(p.senses)
    ? p.senses.flatMap((s: any) => (Array.isArray(s?.examples) ? s.examples : []))
    : [];
  const fromSenses = senseExamples
    .map((ex: any) => normalizeExamplePair(ex))
    .filter((ex): ex is ReviewExample => !!ex?.en && isAdmissibleDisplayExample(ex.en));
  if (fromSenses.length > 0) return fromSenses;

  const top = Array.isArray(p.example_sentences) ? p.example_sentences : [];
  return top
    .map((sent: any) => normalizeExamplePair(sent))
    .filter((ex): ex is ReviewExample => !!ex?.en && isAdmissibleDisplayExample(ex.en));
}

/**
 * 生词复习 4↔4：优先 Cambridge 展示例句；空则回退字段链并去重。
 */
export function extractReviewExampleList(payload: Record<string, any> | null | undefined): ReviewExample[] {
  const primary = extractCambridgeDisplayExamples(payload);
  if (primary.length > 0) return primary;

  const p = payload && typeof payload === 'object' ? payload : {};
  const sources = [p.example_sentences, p.scenarios, p.business_examples, p.examples, p.example];
  const raw = sources.find((s) => Array.isArray(s) && s.length > 0) || [];
  const out: ReviewExample[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const pair = normalizeExamplePair(item);
    if (!pair?.en || !isAdmissibleDisplayExample(pair.en)) continue;
    const key = pair.en.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  if (out.length > 0) return out;

  for (const item of raw) {
    const pair = normalizeExamplePair(item);
    if (!pair?.en || isPhoneticBlockedExample(pair.en)) continue;
    if (englishLetterCount(pair.en) < 2) continue;
    const key = pair.en.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  return out;
}

/** 折叠态 4 槽（不足 null 垫空）+ 超出列表；供复习 UI / 单测共用 */
export function buildReviewExampleSlots(examples: ReviewExample[]): {
  slots: Array<ReviewExample | null>;
  extra: ReviewExample[];
} {
  const list = Array.isArray(examples) ? examples : [];
  return {
    slots: Array.from({ length: 4 }, (_, i) => list[i] ?? null),
    extra: list.slice(4),
  };
}
