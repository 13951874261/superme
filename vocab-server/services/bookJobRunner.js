function cancelled() { const error = new Error('Extraction cancelled'); error.errorCode = 'CANCELLED'; return error; }

function createBookJobRunner({ db, jobs: suppliedJobs, jobService, extractor, chapterService, frameworkService, heavyGate, profile = process.env.BOOK_MVP_PROFILE || 'full', jobType = 'parse', pollMs = 1000, heartbeatMs = 20_000,
  maxAttempts = 3, baseBackoffMs = 1000, now = Date.now } = {}) {
  const jobs = jobService || suppliedJobs;
  const chapters = chapterService || require('./bookChapterService').createBookChapterService(db);
  if (!db || !jobs || (jobType === 'parse' ? !extractor : !frameworkService)) throw new TypeError('db, jobService and job processor are required');
  let stopped = true; let timer; let wake; let loopPromise; let current;

  async function runOnce() {
    if (!stopped && current) return false;
    const job = jobs.claimNext({ now: now(), jobType });
    if (!job) return false;
    const revision = db.prepare('SELECT r.* FROM book_revisions r JOIN books b ON b.active_book_revision_id=r.id WHERE b.id=?').get(job.book_id);
    if (!revision) { jobs.fail(job.id, job.leaseToken, Object.assign(new Error('Book revision missing'), { errorCode: 'UNSUPPORTED_FORMAT' }), { now: now() }); return true; }
    const controller = new AbortController(); current = controller;
    const checkCancelled = () => {
      const row = db.prepare('SELECT status,cancel_requested_at FROM book_jobs WHERE id=?').get(job.id);
      if (!row || row.status !== 'running' || row.cancel_requested_at) controller.abort(cancelled());
      return controller.signal.aborted;
    };
    const heartbeat = setInterval(() => { if (!checkCancelled()) jobs.heartbeat(job.id, job.leaseToken, { now: now() }); }, heartbeatMs);
    try {
      const work = async () => {
        if (jobType === 'framework') return frameworkService.processJob({ jobId: job.id, leaseToken: job.leaseToken, signal: controller.signal });
        await extractor.extract({ revisionId: revision.id, format: revision.detected_format || revision.declared_extension,
          filePath: revision.file_path, inputHash: revision.source_file_hash, signal: controller.signal, isCancelled: checkCancelled });
        if (checkCancelled()) throw cancelled();
        chapters.generateCandidates({ bookRevisionId: revision.id, jobId: job.id });
      };
      await (heavyGate ? heavyGate.run(work) : work());
      if (checkCancelled()) throw cancelled();
      if (jobs.finish(job.id, job.leaseToken, { now: now() })) {
        if (jobType === 'parse') {
          db.prepare("UPDATE book_jobs SET current_stage='awaiting_chapter_confirmation' WHERE id=?").run(job.id);
          db.prepare("UPDATE book_revisions SET status='awaiting_chapter_confirmation' WHERE id=?").run(revision.id);
          db.prepare("UPDATE books SET status='awaiting_chapter_confirmation',updated_at=? WHERE id=?").run(now(), job.book_id);
        } else db.prepare("UPDATE book_jobs SET current_stage='framework_draft_ready' WHERE id=?").run(job.id);
      }
    } catch (error) {
      if (error.errorCode !== 'CANCELLED') {
        const attempt = Number(job.attempt_count || 0) + 1;
        const retrying = Boolean(error.retryable) && !(profile === 'light' && error.errorCode === 'RESOURCE_BUSY') && attempt < maxAttempts;
        jobs.fail(job.id, job.leaseToken, error, { now: now(), retrying, nextAttemptAt: retrying ? now() + baseBackoffMs * (2 ** (attempt - 1)) : null });
      }
    } finally { clearInterval(heartbeat); if (current === controller) current = null; }
    return true;
  }

  async function loop() {
    while (!stopped) {
      if (!await runOnce()) await new Promise((resolve) => { wake = resolve; timer = setTimeout(resolve, pollMs); });
    }
  }
  return {
    runOnce,
    start() { if (loopPromise) return loopPromise; stopped = false; loopPromise = loop().finally(() => { loopPromise = null; }); return loopPromise; },
    async stop() { stopped = true; clearTimeout(timer); wake?.(); current?.abort(cancelled()); await loopPromise; },
  };
}
module.exports = { createBookJobRunner };
