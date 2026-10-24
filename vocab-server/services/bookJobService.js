const crypto = require('node:crypto');

function immediate(db, work) {
  if (typeof db.transaction === 'function') {
    const tx = db.transaction(work);
    return typeof tx.immediate === 'function' ? tx.immediate() : tx();
  }
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

function createBookJobService(db, { leaseMs = 60_000, queueLimit = 8 } = {}) {
  function assertQueueCapacity() {
    if (db.prepare("SELECT count(*) n FROM book_jobs WHERE status IN ('pending','retrying')").get().n < queueLimit) return;
    const error = new Error('book job queue is full');
    error.errorCode = 'RESOURCE_BUSY';
    throw error;
  }

  function claimNext({ now = Date.now(), jobType } = {}) {
    return immediate(db, () => {
      const candidate = jobType
        ? db.prepare(`SELECT id FROM book_jobs WHERE status IN ('pending','retrying') AND job_type=?
            AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at, id LIMIT 1`).get(jobType, now)
        : db.prepare(`SELECT id FROM book_jobs WHERE status IN ('pending','retrying')
            AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at, id LIMIT 1`).get(now);
      if (!candidate) return null;
      const token = crypto.randomUUID();
      const expires = now + leaseMs;
      const changed = db.prepare(`UPDATE book_jobs SET status='running', lease_token=?, lease_expires_at=?,
        heartbeat_at=?, started_at=COALESCE(started_at,?) WHERE id=? AND status IN ('pending','retrying')
        AND (? IS NULL OR job_type=?)`).run(token, expires, now, now, candidate.id, jobType || null, jobType || null).changes;
      return changed ? { ...db.prepare('SELECT * FROM book_jobs WHERE id=?').get(candidate.id), leaseToken: token, leaseExpiresAt: expires } : null;
    });
  }

  function heartbeat(id, token, { now = Date.now() } = {}) {
    return db.prepare(`UPDATE book_jobs SET heartbeat_at=?, lease_expires_at=?
      WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>=?`)
      .run(now, now + leaseMs, id, token, now).changes === 1;
  }

  function assertLease(id, token, { now = Date.now() } = {}) {
    const valid = db.prepare(`SELECT 1 FROM book_jobs WHERE id=? AND status='running' AND lease_token=?
      AND lease_expires_at>=? AND cancel_requested_at IS NULL`).get(id, token, now);
    if (valid) return true;
    const row = db.prepare('SELECT status,cancel_requested_at FROM book_jobs WHERE id=?').get(id);
    const cancelled = row?.status === 'cancelled' || row?.cancel_requested_at;
    const error = new Error(cancelled ? 'book job cancelled' : 'book job lease lost'); error.errorCode = cancelled ? 'CANCELLED' : 'LEASE_LOST'; throw error;
  }

  function finish(id, token, { now = Date.now() } = {}) {
    return db.prepare(`UPDATE book_jobs SET status='completed', finished_at=?, lease_token=NULL, lease_expires_at=NULL
      WHERE id=? AND status='running' AND lease_token=? AND lease_expires_at>=? AND cancel_requested_at IS NULL`)
      .run(now, id, token, now).changes === 1;
  }

  function fail(id, token, error, { now = Date.now(), retrying = Boolean(error.retryable), nextAttemptAt = null } = {}) {
    return db.prepare(`UPDATE book_jobs SET status=?, finished_at=?, error_type=?, error_code=?, error_message=?,
      attempt_count=attempt_count+1, next_attempt_at=?, lease_token=NULL, lease_expires_at=NULL
      WHERE id=? AND status='running' AND lease_token=?`)
      .run(retrying ? 'retrying' : 'failed', retrying ? null : now, error.name || 'Error', error.errorCode || 'UNSUPPORTED_FORMAT', error.message,
        retrying ? nextAttemptAt : null, id, token).changes === 1;
  }

  function recoverExpired({ now = Date.now() } = {}) {
    return db.prepare(`UPDATE book_jobs SET status='retrying', lease_token=NULL, lease_expires_at=NULL
      WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<?`).run(now).changes;
  }

  function requestCancel(id, ownerId, bookId, { now = Date.now() } = {}) {
    return db.prepare(`UPDATE book_jobs SET status='cancelled', cancel_requested_at=?, finished_at=?, lease_token=NULL, lease_expires_at=NULL
      WHERE id=? AND owner_id=? AND book_id=? AND status IN ('pending','retrying','running')`)
      .run(now, now, id, ownerId, bookId).changes === 1;
  }

  function retry(id, ownerId, bookId, { now = Date.now() } = {}) {
    return immediate(db, () => {
      const source = db.prepare('SELECT * FROM book_jobs WHERE id=? AND owner_id=? AND book_id=?').get(id, ownerId, bookId);
      if (!source || !['failed', 'cancelled'].includes(source.status)) return null;
      const retryKey = `retry:${source.id}`;
      const existing = db.prepare('SELECT * FROM book_jobs WHERE idempotency_key=?').get(retryKey);
      if (existing) return existing;
      assertQueueCapacity();
      const retryId = crypto.randomUUID();
      db.prepare(`INSERT OR IGNORE INTO book_jobs
        (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(retryId, source.book_id, source.owner_id, source.job_type, 'retrying', 'queued', retryKey, now);
      return db.prepare('SELECT * FROM book_jobs WHERE idempotency_key=?').get(retryKey);
    });
  }

  function enqueue({ id = crypto.randomUUID(), bookId, ownerId, jobType, idempotencyKey, currentStage = 'queued', now = Date.now() }) {
    return immediate(db, () => {
      const existing = db.prepare(`SELECT * FROM book_jobs WHERE owner_id=? AND book_id=? AND job_type=? AND idempotency_key=?
        ORDER BY created_at DESC LIMIT 1`).get(ownerId, bookId, jobType, idempotencyKey);
      if (existing) return existing;
      assertQueueCapacity();
      db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(id, bookId, ownerId, jobType, 'pending', currentStage, idempotencyKey, now);
      return db.prepare('SELECT * FROM book_jobs WHERE id=?').get(id);
    });
  }

  function ensureStep({ id = crypto.randomUUID(), jobId, chapterId = null, stepType, inputHash }) {
    db.prepare(`INSERT OR IGNORE INTO book_job_steps
      (id,job_id,chapter_id,step_type,status,input_hash,attempt_count) VALUES (?,?,?,?,?,?,0)`)
      .run(id, jobId, chapterId, stepType, 'pending', inputHash);
    return db.prepare(`SELECT * FROM book_job_steps WHERE job_id=? AND step_type=? AND input_hash=?
      AND COALESCE(chapter_id,'')=COALESCE(?,'')`).get(jobId, stepType, inputHash, chapterId);
  }

  function completeStep(id, { outputPath = null, now = Date.now() } = {}) {
    return db.prepare(`UPDATE book_job_steps SET status='completed', output_path=?, finished_at=?
      WHERE id=? AND status<>'completed'`).run(outputPath, now, id).changes === 1;
  }

  return { claimNext, heartbeat, assertLease, finish, fail, recoverExpired, requestCancel, retry, enqueue, ensureStep, completeStep };
}

module.exports = { createBookJobService };
