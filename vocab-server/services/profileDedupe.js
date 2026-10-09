/**
 * Profile Dedupe: parse Dify LLM output + local fallback compress/dedupe.
 * Used by vocab-server/server.js for /api/user/profile/compress and memory ingest merge.
 */

function splitProfileSegments(text, { aggressive = false } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const splitter = aggressive ? /[;；。！？!?\n]+/ : /[;；]\s*/;
  return raw
    .split(splitter)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function normalizeProfileSegment(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/标记:[^\s;；]+/gi, '')
    .replace(/\s+/g, '')
    .slice(0, 500);
}

function profileSegmentBigrams(text) {
  const normalized = normalizeProfileSegment(text);
  const set = new Set();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

function profileSegmentSimilarity(a, b) {
  const na = normalizeProfileSegment(a);
  const nb = normalizeProfileSegment(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;
    return shorter.length / Math.max(longer.length, 1);
  }
  const ba = profileSegmentBigrams(a);
  const bb = profileSegmentBigrams(b);
  if (!ba.size || !bb.size) return 0;
  let inter = 0;
  for (const token of ba) {
    if (bb.has(token)) inter += 1;
  }
  return inter / (ba.size + bb.size - inter);
}

function dedupeProfileLocal(existing, delta, options = {}) {
  const aggressive = Boolean(options.aggressive);
  const maxLen = Number(options.maxLen) > 0 ? Number(options.maxLen) : 2000;
  const segments = [
    ...splitProfileSegments(existing, { aggressive }),
    ...splitProfileSegments(delta, { aggressive }),
  ];
  if (!segments.length) return { mergedProfile: '', dedupeCount: 0 };

  const merged = [];
  let dedupeCount = 0;
  for (const seg of segments) {
    const idx = merged.findIndex((item) => profileSegmentSimilarity(item, seg) >= 0.62);
    if (idx >= 0) {
      merged[idx] = seg;
      dedupeCount += 1;
    } else {
      merged.push(seg);
    }
  }

  let mergedProfile = merged.join('；');
  if (mergedProfile.length > maxLen) {
    // Keep latest segments within budget (时效：尾部优先)
    const kept = [];
    let used = 0;
    for (let i = merged.length - 1; i >= 0; i -= 1) {
      const piece = merged[i];
      const add = (kept.length ? 1 : 0) + piece.length;
      if (used + add > maxLen) continue;
      kept.unshift(piece);
      used += add;
    }
    mergedProfile = kept.join('；') || mergedProfile.slice(0, maxLen);
  }

  return { mergedProfile, dedupeCount };
}

/** Manual compress when LLM fails: aggressive split + dedupe + length cap for 精要 */
function compressProfileLocal(text, maxLen = 900) {
  const input = String(text || '').trim();
  if (!input) return { mergedProfile: '', dedupeCount: 0, source: 'empty' };
  const local = dedupeProfileLocal(input, '', { aggressive: true, maxLen });
  return {
    mergedProfile: local.mergedProfile,
    dedupeCount: local.dedupeCount,
    source: 'local_compress',
  };
}

function stripCodeFences(text) {
  return String(text || '')
    .replace(/^```(?:xml|json|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function pickXmlTag(text, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = String(text || '').match(re);
  return m ? m[1].trim() : '';
}

/**
 * Parse Dify Profile Dedupe LLM output into { mergedProfile, dedupeCount }.
 * Tolerates markdown fences, nested <response>, JSON, or bare profile text.
 */
function parseProfileDedupeXml(rawText) {
  let text = stripCodeFences(String(rawText || ''));
  if (!text) return null;

  text = text
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .trim();

  let mergedProfile = pickXmlTag(text, 'merged_profile');
  let dedupeCountRaw = pickXmlTag(text, 'dedupe_count');

  if (!mergedProfile) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*"merged_profile"[\s\S]*\}/);
      if (jsonMatch) {
        const obj = JSON.parse(jsonMatch[0]);
        mergedProfile = String(obj.merged_profile || obj.mergedProfile || '').trim();
        dedupeCountRaw = String(obj.dedupe_count ?? obj.dedupeCount ?? dedupeCountRaw ?? '');
      }
    } catch {
      /* ignore */
    }
  }

  if (!mergedProfile) {
    const cleaned = text
      .replace(/<\/?response>/gi, '')
      .replace(/<\/?dedupe_count>[\s\S]*$/i, '')
      .trim();
    if (cleaned.length >= 8 && !/<merged_profile\b/i.test(cleaned)) {
      mergedProfile = cleaned.slice(0, 2000);
      dedupeCountRaw = dedupeCountRaw || '0';
    }
  }

  if (!mergedProfile) return null;

  return {
    mergedProfile: mergedProfile.slice(0, 2000),
    dedupeCount: Number(dedupeCountRaw || 0) || 0,
  };
}

/** Pull string/object payload from Dify workflow outputs */
function extractDedupeRawFromWorkflowData(data) {
  const outputs = data?.data?.outputs ?? data?.outputs ?? {};
  const candidates = [
    outputs.result,
    outputs.text,
    outputs.merged_profile,
    outputs.output,
    data?.data?.answer,
    data?.answer,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'object') {
      if (typeof c.merged_profile === 'string' && c.merged_profile.trim()) {
        return `<merged_profile>${c.merged_profile}</merged_profile><dedupe_count>${c.dedupe_count || 0}</dedupe_count>`;
      }
      if (typeof c.text === 'string' && c.text.trim()) return c.text;
      try {
        return JSON.stringify(c);
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const vals = Object.values(outputs || {}).filter((v) => v != null);
    if (vals.length === 1 && typeof vals[0] === 'string') return vals[0];
    if (vals.length) return JSON.stringify(outputs);
  } catch {
    /* ignore */
  }
  return '';
}

module.exports = {
  splitProfileSegments,
  dedupeProfileLocal,
  compressProfileLocal,
  parseProfileDedupeXml,
  extractDedupeRawFromWorkflowData,
};
