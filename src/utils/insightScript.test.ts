import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScriptWorkshopDraft } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import {
  flattenInsightScript,
  evaluateInsightScriptQuality,
  wrapPlainScenarioAsDraft,
  parseInsightScenarioPayload,
} from './insightScript';

function minimalDraft(overrides: Partial<ScriptWorkshopDraft> = {}): ScriptWorkshopDraft {
  const base: ScriptWorkshopDraft = {
    sceneTitle: '测试场景',
    sceneSummary: '摘要一行',
    characters: [
      {
        id: 'c1',
        name: '张三',
        roleTitle: 'VP',
        surfaceGoal: '表面目标',
        hiddenMotive: '隐藏底牌',
        redLine: '红线',
        winCondition: '赢面',
      },
    ],
    infoMatrix: [],
    phases: [
      { phaseId: 1, title: '幕1', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '甲：你好。' },
      { phaseId: 2, title: '幕2', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '乙：你好。' },
      { phaseId: 3, title: '幕3', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '甲：对峙。' },
      { phaseId: 4, title: '幕4', targetDuration: '', targetWordsRange: '', targetRatio: 0.25, content: '乙：收束。' },
    ],
  };
  return { ...base, ...overrides, phases: (overrides.phases as ScriptWorkshopDraft['phases']) || base.phases };
}

test('flattenInsightScript 含标题、角色名、四幕片段', () => {
  const text = flattenInsightScript(minimalDraft());
  assert.match(text, /测试场景/);
  assert.match(text, /张三/);
  assert.match(text, /隐藏底牌/);
  assert.match(text, /甲：你好/);
  assert.match(text, /乙：收束/);
});

test('evaluateInsightScriptQuality：2000 字约 8 分钟为 ok', () => {
  const content = '字'.repeat(2000);
  const draft = minimalDraft({
    phases: [
      { phaseId: 1, title: '1', targetDuration: '', targetWordsRange: '', targetRatio: 1, content },
      { phaseId: 2, title: '2', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 3, title: '3', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 4, title: '4', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
    ],
  });
  const q = evaluateInsightScriptQuality(draft);
  assert.equal(q.totalWords, 2000);
  assert.equal(q.estimatedMinutes, 8);
  assert.equal(q.passedDuration, true);
  assert.equal(q.quality, 'ok');
});

test('evaluateInsightScriptQuality：500 字为 below_standard', () => {
  const content = '字'.repeat(500);
  const draft = minimalDraft({
    phases: [
      { phaseId: 1, title: '1', targetDuration: '', targetWordsRange: '', targetRatio: 1, content },
      { phaseId: 2, title: '2', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 3, title: '3', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
      { phaseId: 4, title: '4', targetDuration: '', targetWordsRange: '', targetRatio: 0, content: '' },
    ],
  });
  const q = evaluateInsightScriptQuality(draft);
  assert.equal(q.quality, 'below_standard');
  assert.equal(q.passedDuration, false);
});

test('wrapPlainScenarioAsDraft 把纯文本放入 phase1', () => {
  const draft = wrapPlainScenarioAsDraft('短案例正文', '通用社交');
  assert.equal(draft.phases[0].content, '短案例正文');
  assert.ok(draft.sceneTitle.includes('通用社交') || draft.sceneTitle.length > 0);
});

test('parseInsightScenarioPayload 优先 draft，否则 scenario 字符串', () => {
  const withDraft = parseInsightScenarioPayload({
    success: true,
    draft: minimalDraft(),
    evaluation: { totalWords: 10, estimatedMinutes: 0.1, passedDuration: false },
    quality: 'below_standard',
  });
  assert.equal(withDraft.draft.sceneTitle, '测试场景');
  assert.equal(withDraft.quality, 'below_standard');

  const withString = parseInsightScenarioPayload({ success: true, scenario: '旧版字符串案例' });
  assert.equal(withString.draft.phases[0].content, '旧版字符串案例');
  assert.equal(withString.quality, 'below_standard');
});
