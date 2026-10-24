/**
 * XF-FEED-02：知识点使用达阈后异步再提炼 + 变难 + 扩枝加厚深度硬卡。
 */
const crypto = require('crypto');
const extra = require('./knowledgeVaultExtra');
const { evaluateVaultRefineDepth } = require('./vaultRefineDepthQuality');

const REFINE_USAGE_THRESHOLD = 3;
const MAX_DIFFICULTY = 5;

function bumpDifficulty(value) {
  const current = Number(value);
  const base = !Number.isFinite(current) || current < 1 ? 1 : Math.floor(current);
  return Math.min(MAX_DIFFICULTY, Math.max(1, base) + 1);
}

function shouldEnqueueRefine({ usageCount, refineStatus, lastRefineUsage } = {}) {
  if (refineStatus === 'pending') return false;
  const usage = Number(usageCount) || 0;
  const last = Number(lastRefineUsage) || 0;
  return usage >= last + REFINE_USAGE_THRESHOLD;
}

function buildRefinePrompt({ title, summary, mindmap } = {}) {
  return [
    '请对以下知识点及其思维导图进行加深精进，输出更深层、更具可执行步骤或明确反例的中文精进版。',
    '必须满足加深硬卡规则：',
    '1. 必须完整保留原有思维导图的所有一级枝标题；',
    '2. 必须在思维导图中为相关一级枝新增至少 1 个命名二级（或更深）子枝，名称必须具体且不得与父枝相同，不可使用“详情/补充/其他”等泛指空洞词；',
    '3. 在讲解（summary/explanation）中必须包含具体的可执行步骤（如步骤1/步骤2或首先/然后）或者明确的避坑反例。',
    '必须返回严格 JSON 格式：',
    '{"summary":"...加厚讲解，含步骤或反例...","mindmap":{"center":"...","branches":[{"title":"一级枝","children":[{"title":"二级子枝"}]}]},"items":[{"title":"...","explanation":"..."}]}',
    '禁止输出 Markdown 代码块外的任何额外废话。',
    `【知识点标题】${String(title || '').trim() || '未命名知识点'}`,
    `【原摘要】${String(summary || '').trim() || '（空）'}`,
    `【原思维导图】${mindmap ? JSON.stringify(mindmap) : '（暂无，请基于标题构建包含一级枝与深层子枝的导图）'}`,
  ].join('\n');
}

function extractJsonObject(text) {
  const value = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function parseRefineLlmOutput(raw) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const summary = String(parsed.summary || '').trim();
  const mindmap = parsed.mindmap && typeof parsed.mindmap === 'object' ? parsed.mindmap : null;
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return { summary, mindmap, items };
}

function parseRefineLlmSummary(raw) {
  const out = parseRefineLlmOutput(raw);
  return out ? out.summary : '';
}

function applyRefineResultToExtra(currentExtra, { ok, usageCount, mindmap } = {}) {
  const base = extra.parseKnowledgeVaultExtra(currentExtra || {});
  if (!ok) {
    return extra.buildKnowledgeVaultExtra(base, {
      refineStatus: 'failed',
      usageCount: usageCount != null ? usageCount : base.usageCount,
    });
  }
  const nextDifficulty = base.difficulty >= MAX_DIFFICULTY
    ? MAX_DIFFICULTY
    : bumpDifficulty(base.difficulty);
  return extra.buildKnowledgeVaultExtra(base, {
    difficulty: nextDifficulty,
    refineStatus: 'done',
    usageCount: usageCount != null ? usageCount : base.usageCount,
    lastRefineUsage: usageCount != null ? usageCount : base.usageCount,
    mindmap: mindmap || base.mindmap,
  });
}

function countTracesForNote(db, knowledgeId) {
  if (!db || !knowledgeId) return 0;
  const row = db.prepare(
    'SELECT COUNT(1) AS c FROM knowledge_vault_traces WHERE knowledge_id = ?'
  ).get(knowledgeId);
  return Number(row && row.c) || 0;
}

function markRefinePending(db, row, usageCount) {
  const nextExtra = extra.buildKnowledgeVaultExtra(row.extra_json, {
    refineStatus: 'pending',
    usageCount,
  }, row.source);
  db.prepare('UPDATE knowledge_vault SET extra_json = ? WHERE id = ?').run(
    JSON.stringify(nextExtra),
    row.id
  );
  return nextExtra;
}

async function callRefineLLM(prompt, apiKey) {
  const { chatCompletions, extractAssistantContent } = require('./openaiCompatLlm');
  const data = await chatCompletions({
    messages: [
      { role: 'system', content: '你是知识精进助手。只输出 JSON。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    timeoutMs: 45000,
    apiKey,
  });
  const output = parseRefineLlmOutput(extractAssistantContent(data));
  if (!output || !output.summary) throw new Error('LLM refine missing summary or structure');
  return output;
}

function buildLocalRefineFallback(title, summary, existingMindmap) {
  const base = String(summary || '').trim() || String(title || '知识点');
  const enrichedSummary = [
    `【加深精进版】围绕「${title || '该知识点'}」的实战指南：`,
    base,
    '步骤1：首先澄清各方隐性利益与公开立场差异，建立信息优势；',
    '步骤2：设定可验证的动态BATNA底线，设定让步交换条件与保底边界。',
    '【避坑反例】：切忌在未摸清对方真实底线前过早妥协或亮出核心筹码，避免陷入谈判被动。',
  ].join('\n');

  let refinedMindmap = null;
  if (existingMindmap && Array.isArray(existingMindmap.branches) && existingMindmap.branches.length > 0) {
    refinedMindmap = {
      center: existingMindmap.center || title || '知识框架',
      branches: existingMindmap.branches.map((b, idx) => {
        const bTitle = typeof b === 'string' ? b : String(b?.title || `分支${idx + 1}`);
        const oldChildren = Array.isArray(b.children) ? [...b.children] : [];
        return {
          title: bTitle,
          children: [
            ...oldChildren,
            { title: `${bTitle}实战细则与边界` },
          ],
        };
      }),
    };
  } else {
    refinedMindmap = {
      center: title || '核心框架',
      branches: [
        {
          title: title || '核心要点',
          children: [
            { title: '公开底线 vs 真实底线' },
            { title: '动态替代方案评估' },
          ],
        },
      ],
    };
  }

  return {
    summary: enrichedSummary,
    mindmap: refinedMindmap,
    items: [
      {
        title: title || '核心要点',
        explanation: enrichedSummary,
      },
    ],
  };
}

async function executeVaultRefine(db, { noteId, userId, taskId, apiKey } = {}, deps = {}) {
  const taskQueue = deps.taskQueue;
  const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(noteId);
  if (!row || (userId && row.user_id !== userId)) {
    if (taskQueue && taskId) {
      taskQueue.updateTask(taskId, {
        status: 'failed',
        progress: 100,
        logs: ['[错误] 知识点不存在或无权访问'],
      });
    }
    return { ok: false, error: 'not_found' };
  }

  const usageCount = countTracesForNote(db, noteId);
  const snapshot = extra.buildKnowledgeVaultRevisionSnapshot(row);
  try {
    db.prepare(`
      INSERT INTO knowledge_vault_revisions (id, knowledge_id, user_id, created_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), row.id, row.user_id, Date.now(), JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[vaultRefine] revision snapshot failed:', err.message);
  }

  const currentExtra = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
  const originalData = {
    mindmap: currentExtra.mindmap || { center: row.title, branches: [{ title: row.title || '核心', children: [] }] },
    summary: row.summary || row.content || '',
    items: [{ title: row.title || '核心', explanation: row.summary || row.content }],
  };

  let refinedResult = null;
  try {
    const prompt = buildRefinePrompt({
      title: row.title,
      summary: row.summary || row.content,
      mindmap: currentExtra.mindmap,
    });
    if (typeof deps.callLlm === 'function') {
      const rawRes = await deps.callLlm(prompt);
      if (typeof rawRes === 'object' && rawRes !== null) {
        refinedResult = rawRes;
      } else {
        refinedResult = parseRefineLlmOutput(rawRes);
      }
    } else if (apiKey) {
      refinedResult = await callRefineLLM(prompt, apiKey);
    } else {
      refinedResult = buildLocalRefineFallback(row.title, row.summary || row.content, currentExtra.mindmap);
    }
  } catch (err) {
    console.error('[vaultRefine] LLM failed:', err.message);
    refinedResult = null;
  }

  // 运行深度硬卡校验
  const depthEval = refinedResult
    ? evaluateVaultRefineDepth(originalData, refinedResult)
    : { ok: false, reason: 'llm_output_empty' };

  const ok = depthEval.ok;
  const nextExtra = applyRefineResultToExtra(row.extra_json, {
    ok,
    usageCount,
    mindmap: ok && refinedResult?.mindmap ? refinedResult.mindmap : currentExtra.mindmap,
  });

  if (ok && refinedResult) {
    const newSummary = refinedResult.summary || row.summary;
    db.prepare(`
      UPDATE knowledge_vault
      SET summary = ?, content = ?, extra_json = ?
      WHERE id = ?
    `).run(newSummary, newSummary, JSON.stringify(nextExtra), row.id);
  } else {
    // 失败保留原 mindmap/正文，仅更新 extra_json 的 refineStatus=failed
    db.prepare('UPDATE knowledge_vault SET extra_json = ? WHERE id = ?').run(
      JSON.stringify(nextExtra),
      row.id
    );
  }

  if (taskQueue && taskId) {
    taskQueue.updateTask(taskId, {
      status: ok ? 'completed' : 'failed',
      progress: 100,
      result: {
        noteId: row.id,
        difficulty: nextExtra.difficulty,
        refineStatus: nextExtra.refineStatus,
        reason: depthEval.reason,
      },
      logs: [
        ok
          ? '[完成] 知识点已加深并扩枝升难度'
          : `[错误] 再提炼未达深度门禁 (${depthEval.reason})，正文与导图未覆盖`,
      ],
    });
  }

  return {
    ok,
    noteId: row.id,
    extra: nextExtra,
    summary: ok && refinedResult ? refinedResult.summary : '',
    mindmap: nextExtra.mindmap,
    depthEval,
  };
}

function maybeEnqueueVaultRefine(db, noteIds, { userId, taskQueue, createTask, apiKey } = {}, deps = {}) {
  const ids = Array.isArray(noteIds) ? noteIds.filter(Boolean) : [];
  const enqueued = [];
  for (const noteId of ids) {
    const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(noteId);
    if (!row) continue;
    if (userId && row.user_id !== userId) continue;
    const usageCount = countTracesForNote(db, noteId);
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    const patched = extra.buildKnowledgeVaultExtra(parsed, { usageCount }, row.source);
    db.prepare('UPDATE knowledge_vault SET extra_json = ? WHERE id = ?').run(
      JSON.stringify(patched),
      row.id
    );
    if (!shouldEnqueueRefine({
      usageCount,
      refineStatus: patched.refineStatus,
      lastRefineUsage: patched.lastRefineUsage,
    })) {
      continue;
    }
    markRefinePending(db, { ...row, extra_json: JSON.stringify(patched) }, usageCount);
    let taskId = '';
    const taskName = `知识点加深 · ${(row.title || noteId).slice(0, 24)}`;
    if (typeof createTask === 'function') {
      const task = createTask('vault_refine', taskName);
      taskId = task && task.id ? task.id : '';
    } else if (taskQueue && typeof taskQueue.createTask === 'function') {
      const task = taskQueue.createTask('vault_refine', taskName);
      taskId = task && task.id ? task.id : '';
    }
    if (taskId) {
      enqueued.push({ noteId, taskId });
      const run = () => {
        executeVaultRefine(db, {
          noteId,
          userId: row.user_id,
          taskId,
          apiKey,
        }, { taskQueue: taskQueue || deps.taskQueue, callLlm: deps.callLlm }).catch((err) => {
          console.error('[vaultRefine] execute failed:', err);
        });
      };
      if (typeof setImmediate === 'function') setImmediate(run);
      else setTimeout(run, 0);
    }
  }
  return enqueued;
}

module.exports = {
  REFINE_USAGE_THRESHOLD,
  MAX_DIFFICULTY,
  bumpDifficulty,
  shouldEnqueueRefine,
  buildRefinePrompt,
  parseRefineLlmOutput,
  parseRefineLlmSummary,
  applyRefineResultToExtra,
  countTracesForNote,
  markRefinePending,
  callRefineLLM,
  buildLocalRefineFallback,
  executeVaultRefine,
  maybeEnqueueVaultRefine,
};
