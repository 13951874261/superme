/**
 * Local profile dedupe logic smoke test (mirrors vocab-server/server.js helpers).
 * Run: node scratch/test-profile-dedupe.mjs
 */

function splitProfileSegments(text) {
  return String(text || '')
    .split(/[;；]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
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

function dedupeProfileLocal(existing, delta) {
  const segments = [...splitProfileSegments(existing), ...splitProfileSegments(delta)];
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
  return { mergedProfile: merged.join('; ').slice(0, 2000), dedupeCount };
}

const existing = [
  '英国(UK) 目标：用户目标为快速提升自我，尚未建立相关习惯',
  '情绪：渴望效率与成长，但缺乏明确路径；标记:smoke-mychat-20260703',
].join('; ');

const delta = [
  '英国(UK) 目标：用户目标为快速提升自我，尚未建立相关习惯',
  '习惯：尚未建立；情绪：渴望效率与成长，但缺乏明确路径；标记:smoke-mychat-20260707',
].join('; ');

const { mergedProfile, dedupeCount } = dedupeProfileLocal(existing, delta);
const goalMatches = (mergedProfile.match(/英国\(UK\) 目标/g) || []).length;

if (dedupeCount < 1) {
  console.error('FAIL: expected at least 1 deduped segment, got', dedupeCount);
  process.exit(1);
}

if (goalMatches !== 1) {
  console.error('FAIL: expected exactly 1 goal segment, got', goalMatches);
  process.exit(1);
}

if (!mergedProfile.includes('20260707')) {
  console.error('FAIL: latest marker not preserved');
  process.exit(1);
}

console.log('OK: profile dedupe local fallback');
console.log('goal segments:', goalMatches, 'deduped:', dedupeCount);
console.log('merged:', mergedProfile.slice(0, 200));
