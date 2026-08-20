/** GT-SIM-02：与前端 toneCorrections.ts 同规则 */

function buildFallbackToneCorrection(fallbackOriginal) {
  const original = String(fallbackOriginal || '').trim() || '（未提供原话）';
  return {
    original,
    problem: '表达过硬或分寸不足，易激怒对方或关闭谈判空间',
    suggested: '先确认对方关切，再说明边界与可协商空间的下一句',
  };
}

function normalizeOne(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const original = String(raw.original ?? raw['原话'] ?? '').trim();
  const problem = String(raw.problem ?? raw['问题'] ?? '').trim();
  const suggested = String(raw.suggested ?? raw['建议说法'] ?? raw.suggestion ?? '').trim();
  if (!original || !problem || !suggested) return null;
  return { original, problem, suggested };
}

function normalizeToneCorrections(raw, fallbackOriginal) {
  const list = Array.isArray(raw) ? raw : [];
  const items = list.map(normalizeOne).filter(Boolean);
  if (items.length > 0) {
    return { items, repaired: false };
  }
  return {
    items: [buildFallbackToneCorrection(fallbackOriginal)],
    repaired: true,
  };
}

module.exports = {
  buildFallbackToneCorrection,
  normalizeToneCorrections,
};
