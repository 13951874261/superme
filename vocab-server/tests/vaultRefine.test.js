/**
 * XF-FEED-01：vaultRefine 触发与难度
 * 运行：node --test vocab-server/tests/vaultRefine.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  REFINE_USAGE_THRESHOLD,
  MAX_DIFFICULTY,
  bumpDifficulty,
  shouldEnqueueRefine,
  buildRefinePrompt,
  parseRefineLlmSummary,
  applyRefineResultToExtra,
} = require('../services/vaultRefine');

describe('vaultRefine constants', () => {
  it('阈值与上限', () => {
    assert.equal(REFINE_USAGE_THRESHOLD, 3);
    assert.equal(MAX_DIFFICULTY, 5);
  });
});

describe('bumpDifficulty', () => {
  it('递增且封顶 5', () => {
    assert.equal(bumpDifficulty(1), 2);
    assert.equal(bumpDifficulty(5), 5);
    assert.equal(bumpDifficulty(0), 2);
  });
});

describe('shouldEnqueueRefine', () => {
  it('usage>=3 且 idle 可入队', () => {
    assert.equal(
      shouldEnqueueRefine({ usageCount: 3, refineStatus: 'idle', lastRefineUsage: 0 }),
      true
    );
  });

  it('pending 不入队', () => {
    assert.equal(
      shouldEnqueueRefine({ usageCount: 10, refineStatus: 'pending', lastRefineUsage: 0 }),
      false
    );
  });

  it('usage 不足不入队', () => {
    assert.equal(
      shouldEnqueueRefine({ usageCount: 2, refineStatus: 'idle', lastRefineUsage: 0 }),
      false
    );
  });

  it('已加深后需再累计满阈值', () => {
    assert.equal(
      shouldEnqueueRefine({ usageCount: 5, refineStatus: 'done', lastRefineUsage: 3 }),
      false
    );
    assert.equal(
      shouldEnqueueRefine({ usageCount: 6, refineStatus: 'done', lastRefineUsage: 3 }),
      true
    );
  });

  it('failed 可重试（达阈）', () => {
    assert.equal(
      shouldEnqueueRefine({ usageCount: 3, refineStatus: 'failed', lastRefineUsage: 0 }),
      true
    );
  });
});

describe('prompt / parse / apply', () => {
  it('buildRefinePrompt 含原摘要', () => {
    const p = buildRefinePrompt({ title: '信息不对称', summary: '旧摘要内容' });
    assert.match(p, /信息不对称/);
    assert.match(p, /旧摘要内容/);
  });

  it('parseRefineLlmSummary 取 JSON summary', () => {
    assert.equal(parseRefineLlmSummary('{"summary":"更深一层的可执行摘要"}'), '更深一层的可执行摘要');
    assert.equal(parseRefineLlmSummary('nonsense'), '');
  });

  it('applyRefineResultToExtra 成功升难度并记 lastRefineUsage', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 1, refineStatus: 'pending', usageCount: 3, lastRefineUsage: 0 },
      { ok: true, usageCount: 3 }
    );
    assert.equal(next.difficulty, 2);
    assert.equal(next.refineStatus, 'done');
    assert.equal(next.lastRefineUsage, 3);
  });

  it('difficulty=5 时成功再提炼不升难度', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 5, refineStatus: 'pending', usageCount: 15, lastRefineUsage: 12 },
      { ok: true, usageCount: 15 }
    );
    assert.equal(next.difficulty, 5);
    assert.equal(next.refineStatus, 'done');
  });

  it('失败标 failed 不改难度', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 2, refineStatus: 'pending', usageCount: 6, lastRefineUsage: 3 },
      { ok: false, usageCount: 6 }
    );
    assert.equal(next.difficulty, 2);
    assert.equal(next.refineStatus, 'failed');
    assert.equal(next.lastRefineUsage, 3);
  });
});
