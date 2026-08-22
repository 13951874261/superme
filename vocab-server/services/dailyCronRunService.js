const crypto = require('crypto');

const PACK_TZ = process.env.DAILY_PACK_CRON_TZ || 'Asia/Shanghai';
const RETENTION_DAYS = 7;
const STANDARD_UNIT_TOTAL = 67; // wakeup + flaw + 64 long + listen
const LISTEN_ONLY_UNIT_TOTAL = 1;
const MAX_EVENTS_PER_STEP = 200;

const SECRET_KEY_RE = /api[_-]?key|authorization|bearer|dify_.*_key|secret|token|password|credential/i;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-]+/gi;
const APP_KEY_RE = /\bapp-[A-Za-z0-9]{8,}\b/g;

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

function getPackDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PACK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addShanghaiDays(packDateYmd, deltaDays) {
  // packDate is calendar date in Asia/Shanghai; shift via UTC noon anchor
  const [y, m, d] = String(packDateYmd).split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(utc + deltaDays * 24 * 60 * 60 * 1000);
  return getPackDate(shifted);
}

function newId(prefix = 'dcr') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizeString(value) {
  let s = String(value ?? '');
  s = s.replace(BEARER_RE, 'Bearer [REDACTED]');
  s = s.replace(APP_KEY_RE, 'app-[REDACTED]');
  return s;
}

function sanitizeValue(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
        continue;
      }
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return sanitizeString(value);
}

function sanitizeCronLogPayload(payload) {
  return sanitizeValue(payload);
}

function toJson(value) {
  if (value == null) return null;
  return JSON.stringify(sanitizeCronLogPayload(value));
}

function initDailyCronRunTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_cron_runs (
      id TEXT PRIMARY KEY,
      cron_tick_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      user_id TEXT NOT NULL,
      trigger_source TEXT NOT NULL DEFAULT 'cron',
      parent_run_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      execution_status TEXT NOT NULL DEFAULT 'pending',
      audit_health TEXT NOT NULL DEFAULT 'ok',
      summary_json TEXT,
      error_message TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      lease_owner TEXT,
      lease_until INTEGER,
      UNIQUE(cron_tick_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_cron_runs_user_date
      ON daily_cron_runs(user_id, pack_date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_cron_runs_tick
      ON daily_cron_runs(cron_tick_id);

    CREATE TABLE IF NOT EXISTS daily_cron_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      module TEXT NOT NULL,
      combo_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      inputs_json TEXT,
      input_sources_json TEXT,
      result_summary_json TEXT,
      attempt INTEGER NOT NULL DEFAULT 1,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_cron_steps_run
      ON daily_cron_steps(run_id, module);
    CREATE INDEX IF NOT EXISTS idx_daily_cron_steps_user
      ON daily_cron_steps(user_id, run_id);

    CREATE TABLE IF NOT EXISTS daily_cron_log_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_id TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      context_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_cron_events_run
      ON daily_cron_log_events(run_id, created_at);
  `);
}

function markInterruptedRunning(db, reason = 'interrupted: server restart') {
  const now = Date.now();
  const msg = sanitizeString(reason);
  const runRes = db.prepare(`
    UPDATE daily_cron_runs
    SET status = 'failed',
        execution_status = 'failed',
        error_message = COALESCE(error_message, ?),
        finished_at = COALESCE(finished_at, ?),
        updated_at = ?,
        lease_owner = NULL,
        lease_until = NULL
    WHERE status = 'running'
  `).run(msg, now, now);

  const stepRes = db.prepare(`
    UPDATE daily_cron_steps
    SET status = 'failed',
        error_message = COALESCE(error_message, ?),
        finished_at = COALESCE(finished_at, ?),
        updated_at = ?
    WHERE status = 'running'
  `).run(msg, now, now);

  return {
    runsInterrupted: runRes.changes,
    stepsInterrupted: stepRes.changes,
  };
}

function retentionCutoffDate(now = new Date()) {
  return addShanghaiDays(getPackDate(now), -RETENTION_DAYS);
}

const FINISHED_RUN_STATUSES = ['completed', 'failed', 'partial_failed'];

function isFinishedRunStatus(status) {
  return FINISHED_RUN_STATUSES.includes(status);
}

function deleteRunRows(db, runIds) {
  if (!runIds.length) {
    return { deletedRuns: 0, deletedSteps: 0, deletedEvents: 0 };
  }
  const placeholders = runIds.map(() => '?').join(',');
  const delEvents = db.prepare(
    `DELETE FROM daily_cron_log_events WHERE run_id IN (${placeholders})`,
  ).run(...runIds);
  const delSteps = db.prepare(
    `DELETE FROM daily_cron_steps WHERE run_id IN (${placeholders})`,
  ).run(...runIds);
  const delRuns = db.prepare(
    `DELETE FROM daily_cron_runs WHERE id IN (${placeholders})`,
  ).run(...runIds);
  return {
    deletedRuns: delRuns.changes,
    deletedSteps: delSteps.changes,
    deletedEvents: delEvents.changes,
  };
}

function deleteRunForUser(db, runId, userId) {
  const ownership = assertRunOwner(db, runId, userId);
  if (!ownership.ok) return { ok: false, code: ownership.code || 404 };
  const status = ownership.run.status;
  if (!isFinishedRunStatus(status)) {
    return { ok: false, code: 409 };
  }
  const stats = deleteRunRows(db, [runId]);
  return { ok: true, code: 200, ...stats };
}

function clearFinishedRunsForUser(db, userId) {
  const uid = normalizeUserId(userId);
  const statusPlaceholders = FINISHED_RUN_STATUSES.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id FROM daily_cron_runs
    WHERE user_id = ?
      AND status IN (${statusPlaceholders})
  `).all(uid, ...FINISHED_RUN_STATUSES);
  const ids = rows.map((r) => r.id);
  return deleteRunRows(db, ids);
}

function cleanupOldCronRuns(db, now = new Date()) {
  const cutoff = retentionCutoffDate(now);
  const oldIds = db.prepare(`
    SELECT id FROM daily_cron_runs
    WHERE pack_date < ?
      AND status != 'running'
  `).all(cutoff).map((r) => r.id);

  if (oldIds.length === 0) {
    return { cutoff, deletedRuns: 0, deletedSteps: 0, deletedEvents: 0 };
  }

  const { deletedRuns, deletedSteps, deletedEvents } = deleteRunRows(db, oldIds);

  return {
    cutoff,
    deletedRuns,
    deletedSteps,
    deletedEvents,
  };
}

function aggregateExecutionStatus(stepStatuses) {
  const list = Array.isArray(stepStatuses) ? stepStatuses : [];
  if (list.length === 0) return 'pending';
  if (list.some((s) => s === 'running' || s === 'pending')) return 'running';
  const terminal = list.filter((s) => s === 'completed' || s === 'failed' || s === 'skipped');
  if (terminal.length === 0) return 'pending';
  const hasFail = terminal.some((s) => s === 'failed');
  const hasOk = terminal.some((s) => s === 'completed' || s === 'skipped');
  if (hasFail && hasOk) return 'partial_failed';
  if (hasFail) return 'failed';
  return 'completed';
}

function computeRunProgress({ finishedUnits, totalUnits }) {
  const total = Number(totalUnits) || 0;
  const finished = Number(finishedUnits) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((finished / total) * 100)));
}

function countFinishedUnits(db, runId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM daily_cron_steps
    WHERE run_id = ?
      AND status IN ('completed', 'failed', 'skipped')
  `).get(runId);
  return Number(row?.n || 0);
}

function createCronTickId() {
  return newId('tick');
}

function createPerUserRun(db, {
  cronTickId,
  userId,
  packDate,
  triggerSource = 'cron',
  parentRunId = null,
  unitTotal = STANDARD_UNIT_TOTAL,
}) {
  const id = newId('run');
  const now = Date.now();
  const uid = normalizeUserId(userId);
  const date = packDate || getPackDate();
  try {
    db.prepare(`
      INSERT INTO daily_cron_runs (
        id, cron_tick_id, pack_date, user_id, trigger_source, parent_run_id,
        status, progress, execution_status, audit_health, summary_json, error_message,
        started_at, finished_at, created_at, updated_at, lease_owner, lease_until
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', 0, 'running', 'ok', ?, NULL, ?, NULL, ?, ?, NULL, NULL)
    `).run(
      id,
      cronTickId,
      date,
      uid,
      triggerSource,
      parentRunId,
      JSON.stringify({ unitTotal }),
      now,
      now,
      now,
    );
    return db.prepare('SELECT * FROM daily_cron_runs WHERE id = ?').get(id);
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return db.prepare(`
        SELECT * FROM daily_cron_runs
        WHERE cron_tick_id = ? AND user_id = ?
      `).get(cronTickId, uid);
    }
    throw err;
  }
}

function getRunByTickUser(db, cronTickId, userId) {
  return db.prepare(`
    SELECT * FROM daily_cron_runs
    WHERE cron_tick_id = ? AND user_id = ?
  `).get(cronTickId, normalizeUserId(userId));
}

function listUserIdsForTick(db, cronTickId) {
  return db.prepare(`
    SELECT user_id FROM daily_cron_runs WHERE cron_tick_id = ?
  `).all(cronTickId).map((r) => r.user_id);
}

function assertRunOwner(db, runId, userId) {
  const run = db.prepare('SELECT * FROM daily_cron_runs WHERE id = ?').get(runId);
  if (!run) return { ok: false, run: null, code: 404 };
  if (normalizeUserId(run.user_id) !== normalizeUserId(userId)) {
    return { ok: false, run: null, code: 404 };
  }
  return { ok: true, run, code: 200 };
}

function markAuditDegraded(db, runId, reason) {
  const now = Date.now();
  try {
    db.prepare(`
      UPDATE daily_cron_runs
      SET audit_health = 'degraded',
          error_message = COALESCE(error_message, ?),
          updated_at = ?
      WHERE id = ?
    `).run(sanitizeString(reason), now, runId);
  } catch {
    // last resort: swallow — caller already in audit failure path
  }
}

function appendLogEvent(db, { runId, stepId = null, level = 'info', message, context = null }) {
  try {
    if (stepId) {
      const count = db.prepare(
        'SELECT COUNT(*) AS n FROM daily_cron_log_events WHERE step_id = ?',
      ).get(stepId);
      if (Number(count?.n || 0) >= MAX_EVENTS_PER_STEP) {
        if (Number(count.n) === MAX_EVENTS_PER_STEP) {
          db.prepare(`
            INSERT INTO daily_cron_log_events (id, run_id, step_id, level, message, context_json, created_at)
            VALUES (?, ?, ?, 'warn', ?, NULL, ?)
          `).run(
            newId('evt'),
            runId,
            stepId,
            sanitizeString(`log events truncated at ${MAX_EVENTS_PER_STEP}`),
            Date.now(),
          );
        }
        return null;
      }
    }
    const id = newId('evt');
    db.prepare(`
      INSERT INTO daily_cron_log_events (id, run_id, step_id, level, message, context_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      runId,
      stepId,
      level,
      sanitizeString(message),
      context == null ? null : toJson(context),
      Date.now(),
    );
    return id;
  } catch (err) {
    markAuditDegraded(db, runId, `audit write failed: ${err.message}`);
    return null;
  }
}

function findStep(db, { runId, module, comboKey = null }) {
  if (comboKey == null) {
    return db.prepare(`
      SELECT * FROM daily_cron_steps
      WHERE run_id = ? AND module = ? AND combo_key IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(runId, module);
  }
  return db.prepare(`
    SELECT * FROM daily_cron_steps
    WHERE run_id = ? AND module = ? AND combo_key = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(runId, module, comboKey);
}

function upsertStep(db, {
  id,
  runId,
  userId,
  module,
  comboKey = null,
  status = 'pending',
  progress = 0,
  errorMessage = null,
  inputs = null,
  inputSources = null,
  resultSummary = null,
  attempt = 1,
  startedAt = null,
  finishedAt = null,
}) {
  const now = Date.now();
  const existingByKey = (!id && runId && module)
    ? findStep(db, { runId, module, comboKey })
    : null;
  const stepId = id || existingByKey?.id || newId('step');
  const existing = id || existingByKey
    ? db.prepare('SELECT id FROM daily_cron_steps WHERE id = ?').get(stepId)
    : null;

  try {
    if (existing) {
      db.prepare(`
        UPDATE daily_cron_steps SET
          status = ?,
          progress = ?,
          error_message = ?,
          inputs_json = COALESCE(?, inputs_json),
          input_sources_json = COALESCE(?, input_sources_json),
          result_summary_json = COALESCE(?, result_summary_json),
          attempt = ?,
          started_at = COALESCE(?, started_at),
          finished_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        status,
        progress,
        errorMessage ? sanitizeString(errorMessage) : null,
        inputs == null ? null : toJson(inputs),
        inputSources == null ? null : toJson(inputSources),
        resultSummary == null ? null : toJson(resultSummary),
        attempt,
        startedAt,
        finishedAt,
        now,
        stepId,
      );
    } else {
      db.prepare(`
        INSERT INTO daily_cron_steps (
          id, run_id, user_id, module, combo_key, status, progress, error_message,
          inputs_json, input_sources_json, result_summary_json, attempt,
          started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stepId,
        runId,
        normalizeUserId(userId),
        module,
        comboKey,
        status,
        progress,
        errorMessage ? sanitizeString(errorMessage) : null,
        inputs == null ? null : toJson(inputs),
        inputSources == null ? null : toJson(inputSources),
        resultSummary == null ? null : toJson(resultSummary),
        attempt,
        startedAt ?? now,
        finishedAt,
        now,
        now,
      );
    }
  } catch (err) {
    markAuditDegraded(db, runId, `step write failed: ${err.message}`);
    return null;
  }
  return db.prepare('SELECT * FROM daily_cron_steps WHERE id = ?').get(stepId);
}

function refreshRunAggregation(db, runId, { unitTotal = STANDARD_UNIT_TOTAL } = {}) {
  const statuses = db.prepare(
    'SELECT status FROM daily_cron_steps WHERE run_id = ?',
  ).all(runId).map((r) => r.status);
  let executionStatus = aggregateExecutionStatus(statuses);
  if (statuses.length < unitTotal && executionStatus === 'completed') {
    executionStatus = 'running';
  }
  const finishedUnits = countFinishedUnits(db, runId);
  const progress = computeRunProgress({ finishedUnits, totalUnits: unitTotal });
  const now = Date.now();
  const finishedAt = (executionStatus === 'running' || executionStatus === 'pending')
    ? null
    : now;
  const auditHealth = (executionStatus === 'failed' || executionStatus === 'partial_failed')
    ? 'degraded'
    : null;

  try {
    db.prepare(`
      UPDATE daily_cron_runs SET
        status = ?,
        execution_status = ?,
        progress = ?,
        audit_health = COALESCE(?, audit_health),
        finished_at = CASE WHEN ? IS NULL THEN finished_at ELSE ? END,
        updated_at = ?,
        summary_json = ?
      WHERE id = ?
    `).run(
      executionStatus,
      executionStatus,
      progress,
      auditHealth,
      finishedAt,
      finishedAt,
      now,
      JSON.stringify({ unitTotal, finishedUnits, stepCount: statuses.length }),
      runId,
    );
  } catch (err) {
    markAuditDegraded(db, runId, `aggregate write failed: ${err.message}`);
  }

  return db.prepare('SELECT * FROM daily_cron_runs WHERE id = ?').get(runId);
}

function buildInputSource({
  name,
  value,
  valuePreview,
  sensitive = false,
  friendlyDescription,
  sourceType,
  sourceRef,
  queryRule = '',
  transform = '',
  fallback = '',
}) {
  const safeValue = sanitizeCronLogPayload(value);
  return {
    name,
    value: safeValue,
    valuePreview: valuePreview != null
      ? sanitizeString(valuePreview)
      : (typeof safeValue === 'string'
        ? (safeValue.length > 80 ? `${safeValue.slice(0, 80)}…` : safeValue)
        : String(safeValue ?? '')),
    sensitive: !!sensitive,
    friendlyDescription: sanitizeString(friendlyDescription || ''),
    technicalDetails: {
      sourceType,
      sourceRef,
      queryRule,
      transform,
      fallback,
    },
  };
}

const LONG_GENRES = ['meeting', 'news', 'podcast', 'reading'];
const LONG_CEFR = ['A2', 'B1', 'B2', 'C1'];
const LONG_DURATIONS = [1, 15, 25, 35];

function listLongArticleComboKeys() {
  const keys = [];
  for (const genre of LONG_GENRES) {
    for (const cefr of LONG_CEFR) {
      for (const duration of LONG_DURATIONS) {
        keys.push(`${genre}|${cefr}|${duration}`);
      }
    }
  }
  return keys;
}

function writeShortCircuitSkippedTree(db, {
  runId,
  userId,
  reason = 'daily_pack_ready_cron_cache',
  inputs = null,
  inputSources = null,
}) {
  const now = Date.now();
  const common = {
    runId,
    userId,
    status: 'skipped',
    progress: 100,
    errorMessage: reason,
    inputs,
    inputSources,
    resultSummary: { reason },
    startedAt: now,
    finishedAt: now,
  };
  upsertStep(db, { ...common, module: 'wakeup' });
  upsertStep(db, { ...common, module: 'flaw' });
  for (const comboKey of listLongArticleComboKeys()) {
    upsertStep(db, { ...common, module: 'long_article', comboKey });
  }
  appendLogEvent(db, {
    runId,
    level: 'info',
    message: `short-circuit skip: ${reason}`,
    context: { skippedLongCombos: 64 },
  });
  return refreshRunAggregation(db, runId, { unitTotal: STANDARD_UNIT_TOTAL });
}

function listRunsForUser(db, userId, { days = RETENTION_DAYS } = {}) {
  const uid = normalizeUserId(userId);
  const since = addShanghaiDays(getPackDate(), -(Number(days) || RETENTION_DAYS) + 1);
  return db.prepare(`
    SELECT * FROM daily_cron_runs
    WHERE user_id = ? AND pack_date >= ?
    ORDER BY created_at DESC
  `).all(uid, since);
}

function getRunDetailForUser(db, runId, userId) {
  const ownership = assertRunOwner(db, runId, userId);
  if (!ownership.ok) return ownership;
  const steps = db.prepare(`
    SELECT * FROM daily_cron_steps WHERE run_id = ? ORDER BY created_at ASC
  `).all(runId);
  const events = db.prepare(`
    SELECT * FROM daily_cron_log_events WHERE run_id = ? ORDER BY created_at ASC LIMIT 2000
  `).all(runId);
  return {
    ok: true,
    code: 200,
    run: ownership.run,
    steps,
    events,
  };
}

const rerunLocks = new Map(); // key -> expiresAt

function acquireRerunLock(userId, parentRunId, mode, ttlMs = 15000) {
  const key = `${normalizeUserId(userId)}:${parentRunId}:${mode}`;
  const now = Date.now();
  const exp = rerunLocks.get(key) || 0;
  if (exp > now) return { ok: false, key };
  rerunLocks.set(key, now + ttlMs);
  return { ok: true, key };
}

function releaseRerunLock(key) {
  if (key) rerunLocks.delete(key);
}

function serializeRunSummary(run, steps = []) {
  const byModule = { wakeup: [], flaw: [], long_article: [], listen: [] };
  for (const s of steps) {
    if (byModule[s.module]) byModule[s.module].push(s);
  }
  const count = (mod, st) => byModule[mod].filter((x) => x.status === st).length;
  return {
    id: run.id,
    type: 'daily_cron',
    name: `每日定时任务 ${run.pack_date}`,
    packDate: run.pack_date,
    cronTickId: run.cron_tick_id,
    userId: run.user_id,
    triggerSource: run.trigger_source,
    parentRunId: run.parent_run_id,
    status: run.status,
    executionStatus: run.execution_status,
    auditHealth: run.audit_health,
    progress: run.progress,
    error: run.error_message,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    modules: {
      wakeup: { total: byModule.wakeup.length, completed: count('wakeup', 'completed'), failed: count('wakeup', 'failed'), skipped: count('wakeup', 'skipped'), running: count('wakeup', 'running') },
      flaw: { total: byModule.flaw.length, completed: count('flaw', 'completed'), failed: count('flaw', 'failed'), skipped: count('flaw', 'skipped'), running: count('flaw', 'running') },
      long_article: { total: byModule.long_article.length, completed: count('long_article', 'completed'), failed: count('long_article', 'failed'), skipped: count('long_article', 'skipped'), running: count('long_article', 'running') },
      listen: { total: byModule.listen.length, completed: count('listen', 'completed'), failed: count('listen', 'failed'), skipped: count('listen', 'skipped'), running: count('listen', 'running') },
    },
  };
}

function parseJsonSafe(raw, fallback = null) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

module.exports = {
  PACK_TZ,
  RETENTION_DAYS,
  STANDARD_UNIT_TOTAL,
  LISTEN_ONLY_UNIT_TOTAL,
  MAX_EVENTS_PER_STEP,
  normalizeUserId,
  getPackDate,
  addShanghaiDays,
  newId,
  sanitizeCronLogPayload,
  initDailyCronRunTables,
  markInterruptedRunning,
  retentionCutoffDate,
  isFinishedRunStatus,
  deleteRunRows,
  deleteRunForUser,
  clearFinishedRunsForUser,
  cleanupOldCronRuns,
  aggregateExecutionStatus,
  computeRunProgress,
  countFinishedUnits,
  createCronTickId,
  createPerUserRun,
  getRunByTickUser,
  listUserIdsForTick,
  assertRunOwner,
  markAuditDegraded,
  appendLogEvent,
  upsertStep,
  refreshRunAggregation,
  buildInputSource,
  listLongArticleComboKeys,
  writeShortCircuitSkippedTree,
  findStep,
  LONG_GENRES,
  LONG_CEFR,
  LONG_DURATIONS,
  listRunsForUser,
  getRunDetailForUser,
  acquireRerunLock,
  releaseRerunLock,
  serializeRunSummary,
  parseJsonSafe,
};
