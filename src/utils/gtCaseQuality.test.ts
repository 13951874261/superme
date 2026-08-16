import { describe, expect, it } from 'vitest';
import {
  evaluateCasePushQuality,
  evaluateVerdictSectionsQuality,
  GT_CASE_BG_MIN,
  GT_VERDICT_SECTIONS_MIN,
} from './gtCaseQuality';

function pad(text: string, min: number): string {
  let s = text;
  while (s.replace(/\s+/g, '').length < min) {
    s += '补充叙述以拉长背景，交代多方博弈与时间压力。';
  }
  return s;
}

describe('gtCaseQuality GT-CASE-02', () => {
  it('短 background → below_standard', () => {
    const r = evaluateCasePushQuality({
      background: '你是中层，老板让你表态。',
      incomplete_info: '你不知道董事会是否已决定换人，也不确定大股东立场。',
      decision_point: '会上你选择公开顶撞、会后密报，还是先保全证据？',
    });
    expect(r.quality).toBe('below_standard');
    expect(r.char_count).toBeLessThan(GT_CASE_BG_MIN);
  });

  it('≥400 且 ≥3 角色线索 → ok', () => {
    const background = pad(
      '你是产品线总监。董事长与CEO在周五闭门会上翻脸，CFO与法务各执一辞，投资人要求你立刻站队。创始人仍握有大股东投票权，秘书已发出重组预读材料。下属团队人心浮动，同事开始私下打听编制。',
      GT_CASE_BG_MIN
    );
    const r = evaluateCasePushQuality({
      background,
      incomplete_info: '你不知道董事长是否已私下承诺保护那位VP，也不确定法务是否已锁证据链。',
      decision_point: '十分钟后点名。你选择当众对账、会后单独报，还是先做证据保全？',
    });
    expect(r.char_count).toBeGreaterThanOrEqual(GT_CASE_BG_MIN);
    expect(r.role_hints).toBeGreaterThanOrEqual(3);
    expect(r.quality).toBe('ok');
  });

  it('四节合计不足 → below_standard；足够 → ok', () => {
    const short = evaluateVerdictSectionsQuality({
      interest_chain: '利益链短。',
      emotion_motives: '情绪短。',
      actionable_strategy: '策略短。',
      script_examples: '话术短。',
    });
    expect(short.quality).toBe('below_standard');
    expect(short.sections_char_count).toBeLessThan(GT_VERDICT_SECTIONS_MIN);

    const longBody = pad('围绕董事会、CEO与投资人的利益拉扯展开，给出可执行动作与话术锚点。', 160);
    const ok = evaluateVerdictSectionsQuality({
      interest_chain: longBody,
      emotion_motives: longBody,
      actionable_strategy: longBody,
      script_examples: longBody,
    });
    expect(ok.sections_char_count).toBeGreaterThanOrEqual(GT_VERDICT_SECTIONS_MIN);
    expect(ok.quality).toBe('ok');
  });
});
