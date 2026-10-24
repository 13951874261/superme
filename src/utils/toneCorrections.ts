/** GT-SIM-02：语气修正对比表 normalize / 兜底 */

export type ToneCorrection = {
  original: string;
  problem: string;
  suggested: string;
};

export function buildFallbackToneCorrection(fallbackOriginal?: string): ToneCorrection {
  const original = String(fallbackOriginal || '').trim() || '（未提供原话）';
  return {
    original,
    problem: '表达过硬或分寸不足，易激怒对方或关闭谈判空间',
    suggested: '先确认对方关切，再说明边界与可协商空间的下一句',
  };
}

function normalizeOne(raw: unknown): ToneCorrection | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const original = String(o.original ?? o.原话 ?? '').trim();
  const problem = String(o.problem ?? o.问题 ?? '').trim();
  const suggested = String(o.suggested ?? o.建议说法 ?? o.suggestion ?? '').trim();
  if (!original || !problem || !suggested) return null;
  return { original, problem, suggested };
}

export function normalizeToneCorrections(
  raw: unknown,
  fallbackOriginal?: string
): { items: ToneCorrection[]; repaired: boolean } {
  const list = Array.isArray(raw) ? raw : [];
  const items = list.map(normalizeOne).filter((x): x is ToneCorrection => Boolean(x));
  if (items.length > 0) {
    return { items, repaired: false };
  }
  return {
    items: [buildFallbackToneCorrection(fallbackOriginal)],
    repaired: true,
  };
}
