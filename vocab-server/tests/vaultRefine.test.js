/**
 * XF-FEED-02：vaultRefine 触发、难度升级与深度硬卡门禁
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
  parseRefineLlmOutput,
  parseRefineLlmSummary,
  applyRefineResultToExtra,
  executeVaultRefine,
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
  it('buildRefinePrompt 含原摘要与思维导图', () => {
    const p = buildRefinePrompt({
      title: '信息不对称',
      summary: '旧摘要内容',
      mindmap: { center: '博弈', branches: [{ title: '信息优势' }] },
    });
    assert.match(p, /信息不对称/);
    assert.match(p, /旧摘要内容/);
    assert.match(p, /信息优势/);
  });

  it('parseRefineLlmOutput 取结构化 JSON', () => {
    const jsonStr = JSON.stringify({
      summary: '更深一层的可执行摘要',
      mindmap: { center: '中心', branches: [{ title: '分支A', children: [{ title: '子分支A1' }] }] },
      items: [{ title: '知识点1', explanation: '步骤1：操作' }],
    });
    const out = parseRefineLlmOutput(jsonStr);
    assert.equal(out.summary, '更深一层的可执行摘要');
    assert.equal(out.mindmap.center, '中心');
    assert.equal(out.mindmap.branches[0].children[0].title, '子分支A1');
  });

  it('parseRefineLlmSummary 取 JSON summary', () => {
    assert.equal(parseRefineLlmSummary('{"summary":"更深一层的可执行摘要"}'), '更深一层的可执行摘要');
    assert.equal(parseRefineLlmSummary('nonsense'), '');
  });

  it('applyRefineResultToExtra 成功升难度并保留更新导图', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 1, refineStatus: 'pending', usageCount: 3, lastRefineUsage: 0 },
      {
        ok: true,
        usageCount: 3,
        mindmap: { center: '谈判', branches: [{ title: '利益', children: [{ title: '真实底线' }] }] },
      }
    );
    assert.equal(next.difficulty, 2);
    assert.equal(next.refineStatus, 'done');
    assert.equal(next.lastRefineUsage, 3);
    assert.equal(next.mindmap.branches[0].children[0].title, '真实底线');
  });

  it('difficulty=5 时成功再提炼不升难度', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 5, refineStatus: 'pending', usageCount: 15, lastRefineUsage: 12 },
      { ok: true, usageCount: 15 }
    );
    assert.equal(next.difficulty, 5);
    assert.equal(next.refineStatus, 'done');
  });

  it('失败标 failed 不改难度且保留原状态', () => {
    const next = applyRefineResultToExtra(
      { difficulty: 2, refineStatus: 'pending', usageCount: 6, lastRefineUsage: 3 },
      { ok: false, usageCount: 6 }
    );
    assert.equal(next.difficulty, 2);
    assert.equal(next.refineStatus, 'failed');
    assert.equal(next.lastRefineUsage, 3);
  });
});

describe('executeVaultRefine with Depth Quality Gate', () => {
  function createMockDb(initialRow) {
    let row = { ...initialRow };
    const revisions = [];
    return {
      getRow: () => row,
      getRevisions: () => revisions,
      prepare(sql) {
        const text = String(sql);
        if (text.includes('SELECT * FROM knowledge_vault WHERE id = ?')) {
          return { get: () => ({ ...row }) };
        }
        if (text.includes('SELECT COUNT(1) AS c FROM knowledge_vault_traces')) {
          return { get: () => ({ c: 3 }) };
        }
        if (text.includes('INSERT INTO knowledge_vault_revisions')) {
          return {
            run: (...args) => {
              revisions.push(args);
            },
          };
        }
        if (text.includes('UPDATE knowledge_vault') && text.includes('summary = ?')) {
          return {
            run: (summary, content, extraJson) => {
              row.summary = summary;
              row.content = content;
              row.extra_json = extraJson;
            },
          };
        }
        if (text.includes('UPDATE knowledge_vault') && text.includes('extra_json = ?')) {
          return {
            run: (extraJson) => {
              row.extra_json = extraJson;
            },
          };
        }
        throw new Error('unexpected sql: ' + text);
      },
    };
  }

  it('F-K1: 仅摘要变长未扩枝，executeVaultRefine 判定失败并保持旧正文', async () => {
    const initialRow = {
      id: 'note-fk1',
      user_id: 'u1',
      title: '谈判力',
      summary: '原始简短摘要',
      content: '原始简短内容',
      source: 'upload_book',
      extra_json: JSON.stringify({
        difficulty: 1,
        refineStatus: 'pending',
        usageCount: 3,
        lastRefineUsage: 0,
        mindmap: {
          center: '谈判力',
          branches: [
            { title: '利益', children: [] },
            { title: 'BATNA', children: [] },
          ],
        },
      }),
    };

    const mockDb = createMockDb(initialRow);

    // LLM 只返回长摘要，导图未扩枝，无步骤无反例
    const fk1LlmOutput = {
      summary: '这是一段很长很长的精进版摘要，但导图完全没有新增任何具体的有效子分支，也没有具体步骤。',
      mindmap: {
        center: '谈判力',
        branches: [
          { title: '利益', children: [] },
          { title: 'BATNA', children: [] },
        ],
      },
      items: [],
    };

    const res = await executeVaultRefine(mockDb, { noteId: 'note-fk1', userId: 'u1' }, {
      callLlm: async () => fk1LlmOutput,
    });

    assert.equal(res.ok, false);
    assert.equal(res.extra.refineStatus, 'failed');
    assert.equal(res.extra.difficulty, 1);
    const updatedRow = mockDb.getRow();
    assert.equal(updatedRow.summary, '原始简短摘要', '未通过硬卡不得覆盖正文');
    assert.equal(mockDb.getRevisions().length, 1, '执行前仍应记录 revision 快照');
  });

  it('F-K2: 合格扩枝且含步骤，executeVaultRefine 成功更新正文与难度', async () => {
    const initialRow = {
      id: 'note-fk2',
      user_id: 'u1',
      title: '谈判力',
      summary: '原始简短摘要',
      content: '原始简短内容',
      source: 'upload_book',
      extra_json: JSON.stringify({
        difficulty: 1,
        refineStatus: 'pending',
        usageCount: 3,
        lastRefineUsage: 0,
        mindmap: {
          center: '谈判力',
          branches: [
            { title: '利益', children: [] },
            { title: 'BATNA', children: [] },
          ],
        },
      }),
    };

    const mockDb = createMockDb(initialRow);

    const fk2LlmOutput = {
      summary: '谈判力加深版：聚焦真实底线拆解与多轮博弈。',
      mindmap: {
        center: '谈判力',
        branches: [
          {
            title: '利益',
            children: [{ title: '公开底线 vs 真实底线' }],
          },
          { title: 'BATNA', children: [] },
        ],
      },
      items: [
        {
          title: '公开底线 vs 真实底线',
          explanation: '步骤1：通过提问探寻对方隐性诉求；步骤2：锁定真实底线并保留备选方案。避坑：切忌直接亮底牌。',
        },
      ],
    };

    const res = await executeVaultRefine(mockDb, { noteId: 'note-fk2', userId: 'u1' }, {
      callLlm: async () => fk2LlmOutput,
    });

    assert.equal(res.ok, true);
    assert.equal(res.extra.refineStatus, 'done');
    assert.equal(res.extra.difficulty, 2);
    assert.equal(res.extra.lastRefineUsage, 3);
    assert.equal(res.extra.mindmap.branches[0].children[0].title, '公开底线 vs 真实底线');
    const updatedRow = mockDb.getRow();
    assert.equal(updatedRow.summary, fk2LlmOutput.summary);
  });
});
