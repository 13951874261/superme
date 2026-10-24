import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScriptWorkshopDraft } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import { PRESET_BENCHMARK_SCRIPTS } from '../components/modules/GameTheory/scriptEvaluator';
import {
  flattenInsightScript,
  evaluateInsightScriptQuality,
  wrapPlainScenarioAsDraft,
  parseInsightScenarioPayload,
  nextInsightPoolAction,
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
      {
        id: 'c2',
        name: '李四',
        roleTitle: '总监',
        surfaceGoal: '表面目标2',
        hiddenMotive: '隐藏底牌2',
        redLine: '红线2',
        winCondition: '赢面2',
      },
      {
        id: 'c3',
        name: '王五',
        roleTitle: '审计',
        surfaceGoal: '表面目标3',
        hiddenMotive: '隐藏底牌3',
        redLine: '红线3',
        winCondition: '赢面3',
      },
    ],
    infoMatrix: [
      { id: 'i1', type: 'public', title: '信息1', content: '内容1' },
      { id: 'i2', type: 'exclusive', title: '信息2', content: '内容2' },
    ],
    phases: [
      { phaseId: 1, title: '幕1', targetDuration: '', targetWordsRange: '', targetRatio: 0.18, content: '**张三**：你好。**李四**：你好。**王五**：你好。' },
      { phaseId: 2, title: '幕2', targetDuration: '', targetWordsRange: '', targetRatio: 0.32, content: '**张三**：试探。**李四**：反驳。**王五**：记录。' },
      { phaseId: 3, title: '幕3', targetDuration: '', targetWordsRange: '', targetRatio: 0.38, content: '**张三**：对峙。**李四**：揭穿。**王五**：宣判。' },
      { phaseId: 4, title: '幕4', targetDuration: '', targetWordsRange: '', targetRatio: 0.12, content: '**张三**：认输。**李四**：收束。**王五**：散会。' },
    ],
  };
  return { ...base, ...overrides, phases: (overrides.phases as ScriptWorkshopDraft['phases']) || base.phases };
}

test('flattenInsightScript 含标题、角色名、四幕片段', () => {
  const text = flattenInsightScript(minimalDraft());
  assert.match(text, /测试场景/);
  assert.match(text, /张三/);
  assert.match(text, /隐藏底牌/);
  assert.match(text, /幕1/);
  assert.match(text, /幕4/);
});

test('evaluateInsightScriptQuality：标杆剧本满足合格带 [8, 12] 分钟且 score ≥ 85 为 ok', () => {
  const draft = PRESET_BENCHMARK_SCRIPTS[0];
  const q = evaluateInsightScriptQuality(draft);
  assert.ok(q.totalWords >= 2100);
  assert.ok(q.estimatedMinutes >= 8 && q.estimatedMinutes <= 12);
  assert.equal(q.passedDuration, true);
  assert.ok((q.scriptScore || 0) >= 85);
  assert.equal(q.passedScript, true);
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
    evaluation: { totalWords: 10, estimatedMinutes: 0.1, passedDuration: false, scriptScore: 30, passedScript: false },
    quality: 'below_standard',
    retryCount: 2,
  });
  assert.equal(withDraft.draft.sceneTitle, '测试场景');
  assert.equal(withDraft.quality, 'below_standard');
  assert.equal(withDraft.retryCount, 2);

  const withString = parseInsightScenarioPayload({ success: true, scenario: '旧版字符串案例' });
  assert.equal(withString.draft.phases[0].content, '旧版字符串案例');
  assert.equal(withString.quality, 'below_standard');
});

test('nextInsightPoolAction: 进页/部分池/刷尽', () => {
  assert.deepEqual(nextInsightPoolAction('enter', 3, 10), { action: 'show', cursor: 0 });
  assert.deepEqual(nextInsightPoolAction('refresh', 0, 4), { action: 'show', cursor: 1 });
  assert.deepEqual(nextInsightPoolAction('refresh', 3, 4), { action: 'backfill', cursor: 3 });
  assert.deepEqual(nextInsightPoolAction('refresh', 0, 0), { action: 'backfill', cursor: 0 });
  assert.deepEqual(nextInsightPoolAction('enter', 0, 0), { action: 'backfill', cursor: 0 });
});

test('nextInsightPoolAction: 10 套刷新互不重复且第 11 次才 backfill', () => {
  const seen = new Set<number>();
  const enter = nextInsightPoolAction('enter', 99, 10);
  assert.equal(enter.action, 'show');
  seen.add(enter.cursor);
  let cursor = enter.cursor;
  for (let i = 0; i < 9; i += 1) {
    const step = nextInsightPoolAction('refresh', cursor, 10);
    assert.equal(step.action, 'show');
    assert.equal(seen.has(step.cursor), false);
    seen.add(step.cursor);
    cursor = step.cursor;
  }
  assert.equal(seen.size, 10);
  assert.deepEqual(nextInsightPoolAction('refresh', cursor, 10), { action: 'backfill', cursor });
});
