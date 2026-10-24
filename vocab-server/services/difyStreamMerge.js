/**
 * Dify SSE answer 合并与 duration 软上限（D1：超限仍可用，仅 warning + 可重试）
 */

/** 约 150 wpm；1 分钟给约 3× 缓冲，避免误杀略长稿 */
const SOFT_WORDS_PER_MINUTE = 450;
const MIN_SOFT_WORDS = 200;
const MAX_SOFT_WORDS = 20000;

function estimateEnglishWordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const cleaned = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function softWordLimitForDuration(duration) {
  const minutes = Math.max(1, Number(duration) || 1);
  const limit = Math.round(minutes * SOFT_WORDS_PER_MINUTE);
  return Math.min(MAX_SOFT_WORDS, Math.max(MIN_SOFT_WORDS, limit));
}

function isOverSoftWordLimit(text, duration) {
  return estimateEnglishWordCount(text) > softWordLimitForDuration(duration);
}

function normalizeForCompare(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 若 incoming 与 current 高度重叠（近似全文重复），取较长的一份，避免 current+incoming 翻倍。
 */
function preferNonDuplicatingMerge(current, incoming) {
  if (!incoming) return current || '';
  if (!current) return incoming;
  const a = normalizeForCompare(current);
  const b = normalizeForCompare(incoming);
  if (!a) return incoming;
  if (!b) return current;
  if (a === b) return current.length >= incoming.length ? current : incoming;

  const looksLikeRepeat = (shortNorm, longNorm) => {
    if (!shortNorm || !longNorm.startsWith(shortNorm)) return false;
    const rest = longNorm.slice(shortNorm.length).trim();
    if (!rest) return false; // 真扩展为空 → 交给长度选择（相等前缀）
    // 剩余部分仍以 short 开头/高度重合 → 重复拼接
    if (rest.startsWith(shortNorm.slice(0, Math.min(80, shortNorm.length)))) return true;
    if (rest.includes(shortNorm.slice(0, Math.min(120, shortNorm.length)))) return true;
    return false;
  };

  // 前缀扩展（流式增量）vs 全文重复拼接
  if (b.startsWith(a)) {
    if (looksLikeRepeat(a, b)) return current;
    return incoming; // 真·更长完整稿
  }
  if (a.startsWith(b)) {
    if (looksLikeRepeat(b, a)) return incoming;
    return current;
  }

  // 一方包含另一方（非前缀，例如夹了噪声头）
  if (a.length > 80 && b.includes(a)) {
    if (incoming.length > current.length * 1.4 && looksLikeRepeat(a, b)) return current;
    return incoming.length >= current.length ? incoming : current;
  }
  if (b.length > 80 && a.includes(b)) {
    if (current.length > incoming.length * 1.4 && looksLikeRepeat(b, a)) return incoming;
    return current.length >= incoming.length ? current : incoming;
  }
  // Jaccard on word tokens for near-duplicates
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 3));
  if (wordsA.size >= 20 && wordsB.size >= 20) {
    let inter = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) inter += 1;
    }
    const union = wordsA.size + wordsB.size - inter;
    const jaccard = union > 0 ? inter / union : 0;
    if (jaccard >= 0.85) {
      // 词集合高度重叠但长度接近翻倍 → 典型「全文又拼了一次」，取较短
      if (incoming.length > current.length * 1.4) return current;
      if (current.length > incoming.length * 1.4) return incoming;
      return current.length >= incoming.length ? current : incoming;
    }
  }
  return null;
}

function mergeStreamAnswer(current, incoming) {
  if (!incoming || typeof incoming !== 'string') return current || '';
  const next = incoming.trim();
  if (!next) return current || '';
  if (!current) return next;
  if (next === current) return current;
  if (next.startsWith(current)) return next;
  if (current.startsWith(next)) return current;

  const preferred = preferNonDuplicatingMerge(current, next);
  if (preferred != null) return preferred;

  return current + incoming;
}

/** Dify 默认 tagged 推理会把 <think> 留在 answer；长文必须剥离（含未闭合标签）。 */
function stripThinkTags(raw) {
  let s = String(raw || '');
  s = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '');
  s = s.replace(/<think\b[^>]*>[\s\S]*/gi, '');
  s = s.replace(/<thinking\b[^>]*>[\s\S]*/gi, '');
  return s.trim();
}

function prepareLongArticleBody(raw) {
  let body = stripThinkTags(raw);
  if (/---VOCAB_JSON_START---/i.test(body)) {
    body = body.split(/---VOCAB_JSON_START---/i)[0];
  }
  body = body.replace(/^[^\n]*(生成完毕|沉浸式听力|阅读长篇材料)[^\n]*\n+/m, '');
  return body.trim();
}

const META_ARTICLE_RE = /the user wants me to write|key parameters\s*:|write segment\s+\d/i;

function isUsableLongArticle(raw) {
  const body = prepareLongArticleBody(raw);
  if (!body) return false;
  if (/<think/i.test(body)) return false;
  if (META_ARTICLE_RE.test(body)) return false;
  return estimateEnglishWordCount(body) >= 40;
}

module.exports = {
  mergeStreamAnswer,
  estimateEnglishWordCount,
  softWordLimitForDuration,
  isOverSoftWordLimit,
  preferNonDuplicatingMerge,
  normalizeForCompare,
  stripThinkTags,
  prepareLongArticleBody,
  isUsableLongArticle,
};
