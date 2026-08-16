/**
 * XF-FEED-01：知识点使用达阈后异步再提炼 + 变难。
 */
const crypto = require('crypto');
const https = require('https');
const extra = require('./knowledgeVaultExtra');

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

function buildRefinePrompt({ title, summary } = {}) {
  return [
    '请把下面的知识点摘要加深一层，输出更可执行、更具体的中文精进版。',
    '必须返回严格 JSON：{"summary":"..."}，禁止 Markdown 与废话。',
    `【标题】${String(title || '').trim() || '未命名知识点'}`,
    `【原摘要】${String(summary || '').trim() || '（空）'}`,
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

function parseRefineLlmSummary(raw) {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return '';
  return String(parsed.summary || '').trim();
}

function applyRefineResultToExtra(currentExtra, { ok, usageCount } = {}) {
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

function callRefineLLM(prompt, apiKey) {
  const llmUrl = process.env.WRITE_GOVERNANCE_LLM_URL || 'https://23.95.214.232/v1/chat/completions';
  const requestBody = JSON.stringify({
    model: 'dify',
    messages: [
      { role: 'system', content: '你是知识精进助手。只输出 JSON。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const request = https.request(llmUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('LLM HTTP ' + response.statusCode + ': ' + raw.slice(0, 200)));
          return;
        }
        try {
          const payload = JSON.parse(raw);
          const content = String(payload?.choices?.[0]?.message?.content || '');
          const summary = parseRefineLlmSummary(content);
          if (!summary) reject(new Error('LLM refine missing summary'));
          else resolve(summary);
        } catch (error) {
          reject(new Error('LLM refine parse failed: ' + error.message));
        }
      });
    });
    request.setTimeout(45000, () => request.destroy(new Error('LLM refine timeout')));
    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
}

function buildLocalRefineFallback(title, summary) {
  const base = String(summary || '').trim() || String(title || '知识点');
  return [
    `【加深版】围绕「${title || '该知识点'}」的可执行要点：`,
    base,
    '应用时请先澄清对方表面诉求与隐藏利益，再给出可验证的下一步动作与话术边界。',
  ].join('\n');
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

  let summary = '';
  try {
    const prompt = buildRefinePrompt({ title: row.title, summary: row.summary || row.content });
    if (typeof deps.callLlm === 'function') {
      summary = await deps.callLlm(prompt);
    } else if (apiKey) {
      summary = await callRefineLLM(prompt, apiKey);
    } else {
      summary = buildLocalRefineFallback(row.title, row.summary || row.content);
    }
  } catch (err) {
    console.error('[vaultRefine] LLM failed:', err.message);
    summary = '';
  }

  const ok = Boolean(String(summary || '').trim());
  const nextExtra = applyRefineResultToExtra(row.extra_json, { ok, usageCount });
  if (ok) {
    db.prepare(`
      UPDATE knowledge_vault
      SET summary = ?, content = ?, extra_json = ?
      WHERE id = ?
    `).run(summary, summary, JSON.stringify(nextExtra), row.id);
  } else {
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
      },
      logs: [ok ? '[完成] 知识点已加深并升难度' : '[错误] 再提炼失败，正文未覆盖'],
    });
  }

  return { ok, noteId: row.id, extra: nextExtra, summary: ok ? summary : '' };
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
  parseRefineLlmSummary,
  applyRefineResultToExtra,
  countTracesForNote,
  markRefinePending,
  callRefineLLM,
  buildLocalRefineFallback,
  executeVaultRefine,
  maybeEnqueueVaultRefine,
};
