/**
 * XF-FEED-01：extra 精进字段
 * 运行：node --test vocab-server/tests/knowledgeVaultExtraFeed.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const extra = require('../services/knowledgeVaultExtra');

describe('parseKnowledgeVaultExtra feed defaults', () => {
  it('缺省 difficulty=1 / refineStatus=idle / usageCount=0', () => {
    const p = extra.parseKnowledgeVaultExtra('{}');
    assert.equal(p.difficulty, 1);
    assert.equal(p.refineStatus, 'idle');
    assert.equal(p.usageCount, 0);
    assert.equal(p.lastRefineUsage, 0);
    assert.equal(p.mindmap, null);
  });

  it('可解析 mindmap 与精进字段', () => {
    const p = extra.parseKnowledgeVaultExtra({
      difficulty: 3,
      refineStatus: 'done',
      usageCount: 7,
      lastRefineUsage: 6,
      mindmap: { center: '谈判', branches: [{ title: '利益' }] },
    });
    assert.equal(p.difficulty, 3);
    assert.equal(p.refineStatus, 'done');
    assert.equal(p.usageCount, 7);
    assert.equal(p.lastRefineUsage, 6);
    assert.equal(p.mindmap.center, '谈判');
    assert.equal(p.mindmap.branches.length, 1);
  });

  it('非法 difficulty / refineStatus 回落默认', () => {
    const p = extra.parseKnowledgeVaultExtra({ difficulty: 99, refineStatus: 'nope' });
    assert.equal(p.difficulty, 5);
    assert.equal(p.refineStatus, 'idle');
  });
});

describe('buildKnowledgeVaultExtra / collect patch', () => {
  it('patch 可写入 mindmap 与 difficulty', () => {
    const next = extra.buildKnowledgeVaultExtra('{}', {
      difficulty: 2,
      refineStatus: 'pending',
      usageCount: 3,
      lastRefineUsage: 0,
      mindmap: { center: 'X', branches: [] },
    });
    assert.equal(next.difficulty, 2);
    assert.equal(next.refineStatus, 'pending');
    assert.deepEqual(next.mindmap, { center: 'X', branches: [] });
  });

  it('collectKnowledgeVaultExtraPatch 透传新字段', () => {
    const patch = extra.collectKnowledgeVaultExtraPatch({
      difficulty: 4,
      refineStatus: 'failed',
      usageCount: 9,
      lastRefineUsage: 6,
      mindmap: { center: 'Y', branches: [{ title: 'a' }] },
    });
    assert.equal(patch.difficulty, 4);
    assert.equal(patch.refineStatus, 'failed');
    assert.equal(patch.usageCount, 9);
    assert.equal(patch.lastRefineUsage, 6);
    assert.equal(patch.mindmap.center, 'Y');
  });
});

describe('sortLinkedKnowledgeRows difficulty first', () => {
  it('难度高优先，其次 confirmedAt', () => {
    const rows = [
      {
        id: 'a',
        added_at: 1,
        extra_json: JSON.stringify({
          syncStatus: 'synced',
          moduleTargets: ['listen'],
          difficulty: 1,
          confirmedAt: 100,
        }),
      },
      {
        id: 'b',
        added_at: 2,
        extra_json: JSON.stringify({
          syncStatus: 'synced',
          moduleTargets: ['listen'],
          difficulty: 3,
          confirmedAt: 50,
        }),
      },
      {
        id: 'c',
        added_at: 3,
        extra_json: JSON.stringify({
          syncStatus: 'synced',
          moduleTargets: ['listen'],
          difficulty: 3,
          confirmedAt: 200,
        }),
      },
    ];
    const sorted = extra.sortLinkedKnowledgeRows(rows);
    assert.deepEqual(sorted.map((r) => r.id), ['c', 'b', 'a']);
  });
});
