import { describe, expect, it } from 'vitest';
import {
  ensureAestheticsResult,
  looksLikeVocabCrossover,
} from './aestheticsResultGuard';

describe('aestheticsResultGuard AE-JUD-01', () => {
  it('flags dictionary-style crossover', () => {
    expect(
      looksLikeVocabCrossover('abandon /əˈbændən/ 词性：动词 复数形式 abandons')
    ).toBe(true);
  });

  it('keeps social etiquette feedback', () => {
    expect(
      looksLikeVocabCrossover('敬酒时杯口应低于主宾，体现分寸与体面，避免抢戏。')
    ).toBe(false);
  });

  it('repairs crossover into social fallback', () => {
    const r = ensureAestheticsResult(
      { feedback: 'phonetic /test/ 词性：名词', score: 8, is_passed: true },
      '政商务饭局与敬酒'
    );
    expect(r.repaired).toBe(true);
    expect(r.feedback).toMatch(/社交指数量化点评/);
    expect(r.feedback).toMatch(/政商务饭局与敬酒/);
    expect(r.is_passed).toBe(true);
  });
});
