import { describe, expect, it } from 'vitest';
import { normalizeToneCorrections } from './toneCorrections';

describe('toneCorrections GT-SIM-02', () => {
  it('空数组兜底 1 行', () => {
    const r = normalizeToneCorrections([], '你没资格过问我的编制。');
    expect(r.repaired).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].original).toBe('你没资格过问我的编制。');
    expect(r.items[0].problem.length).toBeGreaterThan(0);
    expect(r.items[0].suggested.length).toBeGreaterThan(0);
  });

  it('合法数组保留', () => {
    const r = normalizeToneCorrections([
      {
        original: '你没资格过问我的编制。',
        problem: '过硬',
        suggested: '编制安排我会同步边界，也想先听你的关切。',
      },
    ]);
    expect(r.repaired).toBe(false);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].suggested).toMatch(/关切/);
  });

  it('残缺项丢弃后兜底', () => {
    const r = normalizeToneCorrections([{ original: '只有原话' }], '备用原话');
    expect(r.repaired).toBe(true);
    expect(r.items[0].original).toBe('备用原话');
  });
});
