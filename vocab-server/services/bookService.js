const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { canAcceptUpload, createSemaphore, initDeletionQueue, requestDeletion } = require('./bookCleanupService');

const uploadSemaphore = createSemaphore(2);

const MiB = 1024 * 1024;
const FULL_BOOK_FORMAT_LIMITS = new Map([
  ['pdf', 30 * MiB], ['epub', 50 * MiB], ['mobi', 50 * MiB], ['azw3', 50 * MiB], ['txt', 20 * MiB],
]);
const LIGHT_BOOK_FORMAT_LIMITS = new Map([
  ['pdf', 8 * MiB], ['epub', 8 * MiB], ['mobi', 8 * MiB], ['azw3', 8 * MiB], ['txt', 4 * MiB],
]);
const ALLOWED_BOOK_FORMATS = process.env.BOOK_MVP_PROFILE === 'light' ? LIGHT_BOOK_FORMAT_LIMITS : FULL_BOOK_FORMAT_LIMITS;

function transaction(db, work) {
  if (typeof db.transaction === 'function') return db.transaction(work)();
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

function migrateTrainingSessions(db) {
  db.exec('CREATE TABLE IF NOT EXISTS book_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  if (db.prepare("SELECT 1 FROM book_migrations WHERE name='training_sessions_user_date_unique'").get()) return;
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='training_sessions'").get();
  if (!table) return;
  if (!/training_date\s+TEXT\s+UNIQUE/i.test(table.sql || '')) {
    db.prepare('INSERT OR IGNORE INTO book_migrations (name, applied_at) VALUES (?, ?)').run('training_sessions_user_date_unique', Date.now());
    return;
  }
  transaction(db, () => {
    db.exec(`ALTER TABLE training_sessions RENAME TO training_sessions_legacy_book_auth;
      CREATE TABLE training_sessions (
        id TEXT PRIMARY KEY, user_id TEXT, training_date TEXT,
        total_minutes INTEGER DEFAULT 0, listen_minutes INTEGER DEFAULT 0,
        logic_minutes INTEGER DEFAULT 0, extra_json TEXT DEFAULT '{}', created_at INTEGER, updated_at INTEGER,
        UNIQUE(user_id, training_date)
      );
      INSERT INTO training_sessions SELECT * FROM training_sessions_legacy_book_auth;
      DROP TABLE training_sessions_legacy_book_auth;`);
    db.prepare('INSERT INTO book_migrations (name, applied_at) VALUES (?, ?)').run('training_sessions_user_date_unique', Date.now());
  });
}

function migrateRevisionOwner(db) {
  const columns = db.prepare('PRAGMA table_info(book_revisions)').all();
  if (!columns.length || columns.some((column) => column.name === 'owner_id')) return;
  transaction(db, () => {
    db.exec('ALTER TABLE book_revisions ADD COLUMN owner_id TEXT');
    db.exec('UPDATE book_revisions SET owner_id=(SELECT owner_id FROM books WHERE books.id=book_revisions.book_id)');
  });
}

function migrateBookChapters(db) {
  db.exec('CREATE TABLE IF NOT EXISTS book_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const revisionRequired = { source_revision_id: 'TEXT', clone_key: 'TEXT', has_gaps: 'INTEGER NOT NULL DEFAULT 0' };
  const revisionColumns = new Set(db.prepare('PRAGMA table_info(chapter_revisions)').all().map((column) => column.name));
  for (const [name, definition] of Object.entries(revisionRequired)) if (!revisionColumns.has(name)) db.exec(`ALTER TABLE chapter_revisions ADD COLUMN ${name} ${definition}`);
  const required = {
    book_revision_id: 'TEXT', chapter_revision_id: 'TEXT', level: 'INTEGER NOT NULL DEFAULT 1',
    order_index: 'INTEGER NOT NULL DEFAULT 0', start_locator_json: "TEXT NOT NULL DEFAULT '{}'",
    end_locator_json: "TEXT NOT NULL DEFAULT '{}'", source: "TEXT NOT NULL DEFAULT 'auto'",
    status: "TEXT NOT NULL DEFAULT 'draft'", version: 'INTEGER NOT NULL DEFAULT 1',
    created_at: 'INTEGER NOT NULL DEFAULT 0', updated_at: 'INTEGER NOT NULL DEFAULT 0',
  };
  const existing = new Set(db.prepare('PRAGMA table_info(book_chapters)').all().map((column) => column.name));
  for (const [name, definition] of Object.entries(required)) if (!existing.has(name)) db.exec(`ALTER TABLE book_chapters ADD COLUMN ${name} ${definition}`);
  const hasBookId = existing.has('book_id');
  transaction(db, () => {
    if (hasBookId) db.exec(`UPDATE book_chapters SET book_revision_id=(SELECT active_book_revision_id FROM books WHERE books.id=book_chapters.book_id) WHERE book_revision_id IS NULL`);
    db.exec(`UPDATE book_chapters SET status='migration_error',source='migration',updated_at=CASE WHEN updated_at=0 THEN strftime('%s','now')*1000 ELSE updated_at END WHERE book_revision_id IS NULL`);
    db.prepare('INSERT OR REPLACE INTO book_migrations (name,applied_at) VALUES (?,?)').run('book_chapters_story6_complete', Date.now());
  });
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_revision_clone_key ON chapter_revisions(book_revision_id, clone_key) WHERE clone_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_revision_confirm_key ON chapter_revisions(book_revision_id, idempotency_key) WHERE status='confirmed'`);

}

function initBookCore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, original_file_name TEXT NOT NULL,
      status TEXT NOT NULL, active_book_revision_id TEXT, active_framework_revision_id TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, retrieval_disabled INTEGER NOT NULL DEFAULT 0, delete_requested_at INTEGER, deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS book_revisions (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, owner_id TEXT NOT NULL, source_file_hash TEXT NOT NULL, file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL, declared_extension TEXT NOT NULL, detected_format TEXT, detected_mime TEXT,
      validation_result_json TEXT, page_count INTEGER, source_unit_count INTEGER DEFAULT 0, parser_name TEXT,
      parser_version TEXT, conversion_tool TEXT, conversion_version TEXT, conversion_params_json TEXT,
      converted_file_hash TEXT, conversion_map_path TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(owner_id, source_file_hash)
    );
    CREATE TABLE IF NOT EXISTS book_source_units (
      id TEXT PRIMARY KEY, book_revision_id TEXT NOT NULL, unit_type TEXT NOT NULL, unit_index INTEGER NOT NULL,
      resource_path TEXT, raw_text_path TEXT, corrected_text_path TEXT, raw_text_hash TEXT, corrected_text_hash TEXT,
      correction_diff_path TEXT, extractor_version TEXT, correction_model TEXT, correction_prompt_version TEXT,
      locator_json TEXT, status TEXT NOT NULL, flags_json TEXT, UNIQUE(book_revision_id, unit_type, unit_index)
    );
    CREATE TABLE IF NOT EXISTS book_jobs (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, owner_id TEXT NOT NULL, job_type TEXT NOT NULL, status TEXT NOT NULL,
      current_stage TEXT, idempotency_key TEXT, lease_token TEXT, lease_expires_at INTEGER, heartbeat_at INTEGER,
      cancel_requested_at INTEGER, error_type TEXT, error_code TEXT, error_message TEXT, budget_used REAL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER,
      created_at INTEGER NOT NULL, started_at INTEGER, finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS book_job_steps (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL, chapter_id TEXT, step_type TEXT NOT NULL, status TEXT NOT NULL,
      input_hash TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, lease_token TEXT, output_path TEXT,
      cost_amount REAL DEFAULT 0, token_count INTEGER DEFAULT 0, started_at INTEGER, finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS chapter_revisions (
      id TEXT PRIMARY KEY, book_revision_id TEXT NOT NULL, revision_number INTEGER NOT NULL, status TEXT NOT NULL,
      idempotency_key TEXT NOT NULL, source_revision_id TEXT, clone_key TEXT, has_gaps INTEGER NOT NULL DEFAULT 0,
      confirmed_at INTEGER, created_at INTEGER NOT NULL,
      UNIQUE(book_revision_id, revision_number), UNIQUE(book_revision_id, idempotency_key), UNIQUE(book_revision_id, clone_key)
    );
    CREATE TABLE IF NOT EXISTS book_chapters (
      id TEXT PRIMARY KEY, book_revision_id TEXT NOT NULL, chapter_revision_id TEXT, title TEXT NOT NULL,
      level INTEGER NOT NULL, order_index INTEGER NOT NULL, start_locator_json TEXT NOT NULL,
      end_locator_json TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS framework_revisions (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, book_revision_id TEXT NOT NULL, chapter_revision_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL, status TEXT NOT NULL, model TEXT, workflow_version TEXT, prompt_version TEXT,
      workflow_run_id TEXT, token_count INTEGER NOT NULL DEFAULT 0, cost_amount REAL NOT NULL DEFAULT 0,
      source_revision_id TEXT, clone_key TEXT, confirm_key TEXT, created_at INTEGER NOT NULL, confirmed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS framework_nodes (
      id TEXT PRIMARY KEY, framework_revision_id TEXT NOT NULL, parent_id TEXT, node_type TEXT NOT NULL, origin TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL, order_index INTEGER NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_evidence (
      id TEXT PRIMARY KEY, framework_node_id TEXT NOT NULL, book_revision_id TEXT NOT NULL, chapter_id TEXT,
      source_unit_id TEXT NOT NULL, locator_json TEXT NOT NULL, quote TEXT NOT NULL, quote_hash TEXT NOT NULL,
      source_text_hash TEXT NOT NULL, is_valid INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_listen_contents (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, owner_id TEXT NOT NULL, framework_revision_id TEXT NOT NULL,
      framework_node_id TEXT NOT NULL, node_version INTEGER NOT NULL, cache_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL, script TEXT NOT NULL, script_hash TEXT NOT NULL, key_points_json TEXT NOT NULL,
      model TEXT NOT NULL, prompt_version TEXT NOT NULL, generator_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed', error_code TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_listen_audio (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, owner_id TEXT NOT NULL, content_id TEXT NOT NULL,
      framework_revision_id TEXT NOT NULL, cache_key TEXT NOT NULL UNIQUE, content_hash TEXT NOT NULL,
      voice TEXT NOT NULL, rate TEXT NOT NULL, model TEXT NOT NULL, file_path TEXT NOT NULL,
      status TEXT NOT NULL, error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_exercises (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, owner_id TEXT NOT NULL, framework_revision_id TEXT NOT NULL,
      framework_node_id TEXT NOT NULL, training_mode TEXT NOT NULL, prompt TEXT NOT NULL, goals_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL, status TEXT NOT NULL, task_id TEXT, raw_transcript TEXT, polished_transcript TEXT,
      revised_transcript TEXT, duration_seconds REAL, viewed_evidence INTEGER NOT NULL DEFAULT 0,
      evaluation_json TEXT, error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS book_exercise_tasks (
      id TEXT PRIMARY KEY, exercise_id TEXT NOT NULL, book_id TEXT NOT NULL, owner_id TEXT NOT NULL,
      status TEXT NOT NULL, lease_token TEXT NOT NULL, lease_expires_at INTEGER, heartbeat_at INTEGER,
      cancel_requested_at INTEGER, error_code TEXT, input_json TEXT NOT NULL DEFAULT '{}', attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, finished_at INTEGER
    );`);
  const bookColumns = new Set(db.prepare('PRAGMA table_info(books)').all().map((column) => column.name));
  if (!bookColumns.has('retrieval_disabled')) db.exec('ALTER TABLE books ADD COLUMN retrieval_disabled INTEGER NOT NULL DEFAULT 0');
  initDeletionQueue(db);
  const exerciseTaskColumns = new Set(db.prepare('PRAGMA table_info(book_exercise_tasks)').all().map((column) => column.name));
  for (const [name, definition] of Object.entries({ lease_expires_at: 'INTEGER', heartbeat_at: 'INTEGER', input_json: "TEXT NOT NULL DEFAULT '{}'", attempt_count: 'INTEGER NOT NULL DEFAULT 0', next_attempt_at: 'INTEGER' })) if (!exerciseTaskColumns.has(name)) db.exec(`ALTER TABLE book_exercise_tasks ADD COLUMN ${name} ${definition}`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_book_exercise_active ON book_exercise_tasks(exercise_id)");
  const listenContentColumns = new Set(db.prepare('PRAGMA table_info(book_listen_contents)').all().map((column) => column.name));
  if (!listenContentColumns.has('status')) db.exec("ALTER TABLE book_listen_contents ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'");
  if (!listenContentColumns.has('error_code')) db.exec('ALTER TABLE book_listen_contents ADD COLUMN error_code TEXT');
  const frameworkNodeColumns = new Set(db.prepare('PRAGMA table_info(framework_nodes)').all().map((column) => column.name));
  if (!frameworkNodeColumns.has('confidence_level')) db.exec("ALTER TABLE framework_nodes ADD COLUMN confidence_level TEXT NOT NULL DEFAULT 'medium'");
  if (!frameworkNodeColumns.has('chapter_id')) db.exec('ALTER TABLE framework_nodes ADD COLUMN chapter_id TEXT');
  if (!frameworkNodeColumns.has('source_node_ids_json')) db.exec("ALTER TABLE framework_nodes ADD COLUMN source_node_ids_json TEXT NOT NULL DEFAULT '[]'");
  const stepColumns = new Set(db.prepare('PRAGMA table_info(book_job_steps)').all().map((column) => column.name));
  if (!stepColumns.has('output_hash')) db.exec('ALTER TABLE book_job_steps ADD COLUMN output_hash TEXT');
  migrateRevisionOwner(db);
  migrateBookChapters(db);
  const jobColumns = db.prepare('PRAGMA table_info(book_jobs)').all();
  if (!jobColumns.some((column) => column.name === 'attempt_count')) db.exec('ALTER TABLE book_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0');
  if (!jobColumns.some((column) => column.name === 'next_attempt_at')) db.exec('ALTER TABLE book_jobs ADD COLUMN next_attempt_at INTEGER');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_book_revision_owner_hash ON book_revisions(owner_id, source_file_hash);
    CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_book_jobs_owner ON book_jobs(owner_id, book_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_book_jobs_retry_key ON book_jobs(idempotency_key) WHERE idempotency_key LIKE 'retry:%';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_book_job_steps_input ON book_job_steps(job_id, step_type, input_hash, COALESCE(chapter_id,''));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_revision_number ON framework_revisions(book_id, revision_number);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_clone_key ON framework_revisions(book_id, clone_key) WHERE clone_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_framework_confirm_key ON framework_revisions(book_id, confirm_key) WHERE confirm_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_framework_nodes_revision ON framework_nodes(framework_revision_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_evidence_node ON knowledge_evidence(framework_node_id);`);
  migrateTrainingSessions(db);
}

function validateBookFile(extension, bytes) {
  if (!ALLOWED_BOOK_FORMATS.has(extension)) return { ok: false, error: 'unsupported book format' };
  if (extension === 'pdf') return bytes.subarray(0, 5).toString() === '%PDF-' && bytes.includes(Buffer.from('%%EOF'))
    ? { ok: true } : { ok: false, error: 'invalid PDF signature' };
  if (extension === 'epub') {
    const zip = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const mimetype = bytes.includes(Buffer.from('mimetypeapplication/epub+zip'));
    const drm = bytes.includes(Buffer.from('META-INF/rights.xml')) || bytes.includes(Buffer.from('urn:uuid:')) && bytes.includes(Buffer.from('EncryptedData'));
    return zip && mimetype && !drm ? { ok: true } : { ok: false, error: drm ? 'DRM protected EPUB' : 'invalid EPUB container' };
  }
  if (extension === 'mobi' || extension === 'azw3') {
    if (bytes.length < 94 || bytes.readUInt16BE(76) < 1) return { ok: false, error: 'invalid PalmDB container' };
    const recordOffset = bytes.readUInt32BE(78);
    if (recordOffset + 20 > bytes.length || bytes.subarray(recordOffset + 16, recordOffset + 20).toString() !== 'MOBI') {
      return { ok: false, error: 'invalid MOBI header' };
    }
    const encryptionType = bytes.readUInt16BE(recordOffset + 12);
    return encryptionType === 0 ? { ok: true } : { ok: false, error: 'DRM protected MOBI' };
  }
  const utf16Bom = bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe])) || bytes.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]));
  if (!utf16Bom && bytes.includes(0)) return { ok: false, error: 'TXT contains NUL bytes' };
  if (!utf16Bom && bytes.length && [...bytes].filter((byte) => byte < 9 || byte > 13 && byte < 32).length / bytes.length > 0.01) return { ok: false, error: 'TXT appears binary' };
  if (utf16Bom || bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return { ok: true };
  for (const encoding of ['utf-8', 'gb18030', 'windows-1252']) { try { new TextDecoder(encoding, { fatal: true }).decode(bytes); return { ok: true }; } catch {} }
  return { ok: false, error: 'TXT encoding unsupported' };
}

function readValidationBytes(filePath, size) {
  const chunkSize = Math.min(size, 256 * 1024);
  const head = Buffer.alloc(chunkSize);
  const tail = size > chunkSize ? Buffer.alloc(Math.min(size - chunkSize, 64 * 1024)) : Buffer.alloc(0);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, head, 0, head.length, 0);
    if (tail.length) fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    return tail.length ? Buffer.concat([head, tail]) : head;
  } finally { fs.closeSync(fd); }
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function recoverStaged(db, tempDir, sourceDir) {
  const rows = db.prepare(`SELECT b.id, r.file_path FROM books b
    LEFT JOIN book_revisions r ON r.book_id=b.id AND r.status='staged' WHERE b.status='staged'`).all();
  for (const row of rows) {
    if (row.file_path && isInside(sourceDir, row.file_path)) fs.rmSync(row.file_path, { force: true });
    transaction(db, () => {
      db.prepare('DELETE FROM book_jobs WHERE book_id=?').run(row.id);
      db.prepare('DELETE FROM book_revisions WHERE book_id=?').run(row.id);
      db.prepare('DELETE FROM books WHERE id=?').run(row.id);
    });
  }
  for (const name of fs.readdirSync(tempDir)) fs.rmSync(path.join(tempDir, name), { force: true, recursive: true });
}

function createBookRouter({ db, storageRoot, jobService, chapterService, frameworkService, listenService, exerciseService }) {
  initBookCore(db);
  const jobs = jobService || require('./bookJobService').createBookJobService(db);
  const chapters = chapterService || require('./bookChapterService').createBookChapterService(db);
  const frameworks = frameworkService || require('./bookFrameworkService').createBookFrameworkService(db);
  const listen = listenService || null;
  const exercises = exerciseService || null;
  jobs.recoverExpired();
  const tempDir = path.join(storageRoot, 'temp');
  const sourceDir = path.join(storageRoot, 'source');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });
  recoverStaged(db, tempDir, sourceDir);
  const upload = multer({ dest: tempDir, limits: { fileSize: 50 * MiB } }).single('file');
  const exerciseAudioDir = path.join(storageRoot, 'exercise-audio');
  fs.mkdirSync(exerciseAudioDir, { recursive: true });
  const exerciseUpload = multer({ dest: exerciseAudioDir, limits: { fileSize: 20 * MiB } }).single('file');
  const router = express.Router();

  router.post('/', (req, res) => uploadSemaphore.run(() => new Promise((done) => upload(req, res, (error) => {
    const reply = (status, errorMessage, errorCode, retryable = false) => { res.status(status).json({ error: errorMessage, errorCode, retryable }); done(); };
    if (error) return reply(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.message, error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_INVALID');
    if (!req.file) return reply(400, 'file required', 'FILE_REQUIRED');
    const availableBytes = fs.statfsSync(storageRoot).bavail * fs.statfsSync(storageRoot).bsize;
    if (!canAcceptUpload({ availableBytes, uploadBytes: req.file.size, format: path.extname(req.file.originalname).slice(1).toLowerCase() })) { fs.rmSync(req.file.path, { force: true }); return reply(507, 'insufficient disk space', 'DISK_SPACE_LOW'); }
    const extension = path.extname(req.file.originalname).slice(1).toLowerCase();
    const limit = ALLOWED_BOOK_FORMATS.get(extension);
    const validation = limit && req.file.size <= limit ? validateBookFile(extension, readValidationBytes(req.file.path, req.file.size)) : null;
    if (!limit || req.file.size > limit || !validation.ok) {
      fs.rmSync(req.file.path, { force: true });
      const status = !limit ? 415 : req.file.size > limit ? 413 : 422;
      return reply(status, validation?.error || (!limit ? 'unsupported book format' : 'file too large'), !limit ? 'UNSUPPORTED_FORMAT' : req.file.size > limit ? 'FILE_TOO_LARGE' : 'INVALID_BOOK_FILE');
    }
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(req.file.path);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', (err) => { fs.rmSync(req.file.path, { force: true }); if (!res.headersSent) reply(500, err.message, 'UPLOAD_READ_FAILED'); else done(); });
    input.on('end', () => {
      const sourceHash = hash.digest('hex');
      const duplicate = db.prepare(`SELECT b.id AS book_id, b.created_at, j.id AS job_id, j.status AS job_status
        FROM book_revisions r JOIN books b ON b.id=r.book_id LEFT JOIN book_jobs j ON j.book_id=b.id
        WHERE r.owner_id=? AND r.source_file_hash=? AND b.deleted_at IS NULL ORDER BY j.created_at DESC LIMIT 1`).get(req.auth.userId, sourceHash);
      if (duplicate) {
        fs.rmSync(req.file.path, { force: true });
        res.json({ bookId: duplicate.book_id, jobId: duplicate.job_id, jobStatus: duplicate.job_status, createdAt: duplicate.created_at, deduplicated: true }); return done();
      }
      const now = Date.now();
      const bookId = crypto.randomUUID();
      const revisionId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const destination = path.join(sourceDir, `${revisionId}.${extension}`);
      try {
        transaction(db, () => {
          if (db.prepare("SELECT count(*) AS n FROM book_jobs WHERE status IN ('pending','retrying')").get().n >= 8) {
            const queueError = new Error('服务器繁忙，请稍后重试');
            queueError.errorCode = 'RESOURCE_BUSY';
            throw queueError;
          }
          db.prepare(`INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
            .run(bookId, req.auth.userId, path.basename(req.file.originalname, path.extname(req.file.originalname)), req.file.originalname, 'staged', revisionId, now, now);
          db.prepare(`INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,detected_format,validation_result_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(revisionId, bookId, req.auth.userId, sourceHash, destination, req.file.size, extension, extension, JSON.stringify(validation), 'staged', now);
          db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?)`)
            .run(jobId, bookId, req.auth.userId, 'parse', 'staged', 'staged', sourceHash, now);
        });
        fs.renameSync(req.file.path, destination);
        transaction(db, () => {
          db.prepare("UPDATE books SET status='pending', updated_at=? WHERE id=? AND status='staged'").run(Date.now(), bookId);
          db.prepare("UPDATE book_revisions SET status='pending' WHERE id=? AND status='staged'").run(revisionId);
          db.prepare("UPDATE book_jobs SET status='pending', current_stage='queued' WHERE id=? AND status='staged'").run(jobId);
        });
        res.status(201).json({ bookId, jobId, jobStatus: 'pending', createdAt: now }); done();
      } catch (err) {
        fs.rmSync(req.file.path, { force: true }); fs.rmSync(destination, { force: true });
        try { transaction(db, () => { db.prepare('DELETE FROM book_jobs WHERE book_id=?').run(bookId); db.prepare('DELETE FROM book_revisions WHERE book_id=?').run(bookId); db.prepare('DELETE FROM books WHERE id=?').run(bookId); }); } catch {}
        if (err.errorCode === 'RESOURCE_BUSY') return reply(503, '服务器繁忙，请稍后重试', 'RESOURCE_BUSY', true);
        if (String(err.code || err.message).includes('CONSTRAINT')) {
          const winner = db.prepare(`SELECT b.id AS book_id, b.created_at, j.id AS job_id, j.status AS job_status
            FROM book_revisions r JOIN books b ON b.id=r.book_id LEFT JOIN book_jobs j ON j.book_id=b.id
            WHERE r.owner_id=? AND r.source_file_hash=? AND b.deleted_at IS NULL ORDER BY j.created_at DESC LIMIT 1`).get(req.auth.userId, sourceHash);
          if (winner) { res.json({ bookId: winner.book_id, jobId: winner.job_id, jobStatus: winner.job_status, createdAt: winner.created_at, deduplicated: true }); return done(); }
        }
        reply(500, err.message, 'INTERNAL_ERROR');
      }
    });
  }))));

  router.get('/', (req, res) => res.json({ books: db.prepare("SELECT * FROM books WHERE owner_id=? AND deleted_at IS NULL AND status<>'staged' ORDER BY created_at DESC").all(req.auth.userId) }));
  router.get('/:bookId', (req, res) => {
    const book = db.prepare("SELECT * FROM books WHERE id=? AND owner_id=? AND deleted_at IS NULL AND status<>'staged'").get(req.params.bookId, req.auth.userId);
    return book ? res.json({ book }) : res.status(404).json({ error: 'book not found' });
  });
  router.delete('/:bookId', (req, res) => {
    const row = db.prepare('SELECT * FROM books WHERE id=? AND owner_id=?').get(req.params.bookId, req.auth.userId);
    if (!row) return res.status(404).json({ error: 'book not found', errorCode: 'NOT_FOUND' });
    if (!row.delete_requested_at) requestDeletion(db, req.params.bookId);
    if (listen) listen.deleteBookArtifacts({ bookId: req.params.bookId, ownerId: req.auth.userId, allowDeleted: true });
    return res.status(204).end();
  });
  const findOwnedJob = (req) => db.prepare("SELECT * FROM book_jobs WHERE id=? AND book_id=? AND owner_id=? AND status<>'staged'")
    .get(req.params.jobId, req.params.bookId, req.auth.userId);
  const notFound = (res) => res.status(404).json({ error: 'job not found', errorCode: 'JOB_NOT_FOUND' });
  router.get('/:bookId/jobs/:jobId', (req, res) => {
    const job = findOwnedJob(req);
    if (!job) return notFound(res);
    const progress = db.prepare(`SELECT
      count(DISTINCT chapter_id) AS totalChapters,
      count(DISTINCT CASE WHEN status='completed' THEN chapter_id END) AS completedChapters,
      count(DISTINCT CASE WHEN status='failed' AND NOT EXISTS (
        SELECT 1 FROM book_job_steps newer WHERE newer.job_id=book_job_steps.job_id
          AND COALESCE(newer.chapter_id,'')=COALESCE(book_job_steps.chapter_id,'')
          AND newer.step_type=book_job_steps.step_type AND newer.input_hash=book_job_steps.input_hash
          AND newer.status IN ('pending','retrying','running','completed')) THEN chapter_id END) AS failedChapters
      FROM book_job_steps WHERE job_id=?`).get(job.id);
    const queuePosition = ['pending', 'retrying'].includes(job.status)
      ? db.prepare(`SELECT count(*) + 1 AS position FROM book_jobs WHERE status IN ('pending','retrying')
          AND (created_at<? OR (created_at=? AND id<?))`).get(job.created_at, job.created_at, job.id).position
      : null;
    return res.json({ job: { ...job, ...progress, queuePosition, currentStage: job.current_stage } });
  });
  router.post('/:bookId/jobs/:jobId/retry', (req, res) => {
    if (!findOwnedJob(req)) return notFound(res);
    try {
      const job = jobs.retry(req.params.jobId, req.auth.userId, req.params.bookId);
      return job ? res.json({ job }) : res.status(409).json({ error: 'job cannot be retried', errorCode: 'INVALID_JOB_STATE' });
    } catch (error) {
      if (error.errorCode === 'RESOURCE_BUSY') return process.env.BOOK_MVP_PROFILE === 'light'
        ? res.status(503).json({ error: '服务器繁忙，请稍后重试', errorCode: 'RESOURCE_BUSY', retryable: true })
        : res.status(429).json({ error: error.message, errorCode: error.errorCode });
      throw error;
    }
  });
  router.post('/:bookId/jobs/:jobId/cancel', (req, res) => {
    const current = findOwnedJob(req);
    if (!current) return notFound(res);
    if (current.status === 'cancelled') return res.json({ job: current });
    if (!jobs.requestCancel(req.params.jobId, req.auth.userId, req.params.bookId)) {
      return res.status(409).json({ error: 'job cannot be cancelled', errorCode: 'INVALID_JOB_STATE' });
    }
    return res.json({ job: findOwnedJob(req) });
  });
  const chapterError = (res, error) => {
    const status = error.errorCode === 'NOT_FOUND' ? 404 : error.errorCode === 'VALIDATION_ERROR' ? 422 : error.errorCode === 'INVALID_STATE' ? 409 : 500;
    return res.status(status).json({ error: error.message, errorCode: error.errorCode });
  };
  router.get('/:bookId/chapters', (req, res) => {
    try { return res.json({ chapters: chapters.list({ bookId: req.params.bookId, ownerId: req.auth.userId }) }); }
    catch (error) { return chapterError(res, error); }
  });
  router.patch('/:bookId/chapters/:chapterId', (req, res) => {
    try { return res.json({ chapter: chapters.updateDraft({ bookId: req.params.bookId, ownerId: req.auth.userId, chapterId: req.params.chapterId, patch: req.body || {} }) }); }
    catch (error) { return chapterError(res, error); }
  });
  router.post('/:bookId/chapters/revisions/:revisionId/draft', (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required', errorCode: 'IDEMPOTENCY_KEY_REQUIRED' });
    try { return res.json({ chapterRevision: chapters.cloneDraft({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, idempotencyKey }) }); }
    catch (error) { return chapterError(res, error); }
  });
  router.post('/:bookId/chapters/confirm', (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required', errorCode: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const chapterRevision = chapters.confirm({ bookId: req.params.bookId, ownerId: req.auth.userId, idempotencyKey, draftRevisionId: req.body?.draftRevisionId || null });
      const frameworkJob = jobs.enqueue({ bookId: req.params.bookId, ownerId: req.auth.userId, jobType: 'framework', idempotencyKey: `framework:${chapterRevision.id}` });
      db.prepare("UPDATE books SET status='processing_framework',updated_at=? WHERE id=? AND owner_id=?").run(Date.now(), req.params.bookId, req.auth.userId);
      return res.json({ chapterRevision, frameworkJob });
    } catch (error) { return chapterError(res, error); }
  });
  const frameworkError = (res, error) => res.status(error.errorCode === 'NOT_FOUND' ? 404 : ['INVALID_STATE', 'CANCELLED', 'LEASE_LOST'].includes(error.errorCode) ? 409 : ['VALIDATION_ERROR', 'LISTEN_SCHEMA_INVALID', 'FRAMEWORK_QUALITY_FAILED', 'EVIDENCE_INVALID', 'WORKFLOW_SCHEMA_INVALID'].includes(error.errorCode) ? 422 : error.errorCode === 'RESOURCE_BUSY' ? 429 : ['TTS_FAILED', 'LISTEN_GENERATION_FAILED'].includes(error.errorCode) ? 502 : 500).json({ error: error.message, errorCode: error.errorCode || 'INTERNAL_ERROR' });
  router.get('/:bookId/frameworks', (req, res) => { try { return res.json({ frameworks: frameworks.list({ bookId: req.params.bookId, ownerId: req.auth.userId }) }); } catch (e) { return frameworkError(res, e); } });
  router.get('/:bookId/frameworks/:revisionId', (req, res) => { try { return res.json(frameworks.detail({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId })); } catch (e) { return frameworkError(res, e); } });
  router.patch('/:bookId/frameworks/:revisionId/nodes/:nodeId', (req, res) => { try { return res.json({ node: frameworks.updateNode({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, patch: req.body || {} }) }); } catch (e) { return frameworkError(res, e); } });
  router.post('/:bookId/frameworks/:revisionId/merge', (req, res) => { try { return res.json({ node: frameworks.merge({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, targetNodeId: req.body?.targetNodeId, sourceNodeIds: req.body?.sourceNodeIds }) }); } catch (e) { return frameworkError(res, e); } });
  router.get('/:bookId/frameworks/:revisionId/evidence', (req, res) => { try { return res.json({ evidence: frameworks.evidence({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId }).map((item) => ({ ...item, locator: JSON.parse(item.locator_json) })) }); } catch (e) { return frameworkError(res, e); } });
  router.post('/:bookId/frameworks/:revisionId/draft', (req, res) => { const key=req.get('Idempotency-Key'); if(!key)return res.status(400).json({error:'Idempotency-Key required',errorCode:'IDEMPOTENCY_KEY_REQUIRED'}); try{return res.json({frameworkRevision:frameworks.cloneDraft({bookId:req.params.bookId,ownerId:req.auth.userId,revisionId:req.params.revisionId,idempotencyKey:key})});}catch(e){return frameworkError(res,e);} });
  router.post('/:bookId/frameworks/:revisionId/confirm', (req, res) => { const key=req.get('Idempotency-Key'); if(!key)return res.status(400).json({error:'Idempotency-Key required',errorCode:'IDEMPOTENCY_KEY_REQUIRED'}); try{return res.json({frameworkRevision:frameworks.confirm({bookId:req.params.bookId,ownerId:req.auth.userId,revisionId:req.params.revisionId,idempotencyKey:key})});}catch(e){return frameworkError(res,e);} });
  if (exercises) {
    const exerciseError = (res, error) => res.status(error.errorCode === 'NOT_FOUND' ? 404 : error.errorCode === 'TRANSCRIPTION_EMPTY' || error.errorCode === 'VALIDATION_ERROR' ? 422 : error.errorCode === 'EVALUATION_FAILED' ? 502 : 500).json({ error: error.message, errorCode: error.errorCode || 'INTERNAL_ERROR' });
    router.post('/:bookId/exercises/transcriptions', (req, res) => exerciseUpload(req, res, async (uploadError) => {
      if (uploadError) return res.status(uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: uploadError.message, errorCode: 'VALIDATION_ERROR' });
      if (!db.prepare('SELECT 1 FROM books WHERE id=? AND owner_id=? AND deleted_at IS NULL').get(req.params.bookId, req.auth.userId)) { if (req.file) fs.rmSync(req.file.path, { force: true }); return res.status(404).json({ error: 'book not found', errorCode: 'NOT_FOUND' }); }
      if (!req.file) return res.status(400).json({ error: 'file required', errorCode: 'VALIDATION_ERROR' });
      try { return res.json(await exercises.transcribeAudio(req.file, req.auth.userId)); } catch (e) { return exerciseError(res, e); } finally { fs.rmSync(req.file.path, { force: true }); }
    }));
    router.post('/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises', (req, res) => { try { return res.status(201).json({ exercise: exercises.create({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, trainingMode: req.body?.trainingMode }) }); } catch (e) { return exerciseError(res, e); } });
    router.post('/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises/:exerciseId/evaluate', (req, res) => { try { const task = exercises.submit({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, exerciseId: req.params.exerciseId, ...(req.body || {}) }); return res.status(202).json({ taskId: task.id, status: task.status, createdAt: task.created_at }); } catch (e) { return exerciseError(res, e); } });
    router.post('/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises/:exerciseId/evaluate/cancel', (req, res) => { try { return res.json({ exercise: exercises.cancel({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, exerciseId: req.params.exerciseId }) }); } catch (e) { return exerciseError(res, e); } });
    router.get('/:bookId/frameworks/:revisionId/nodes/:nodeId/exercises/:exerciseId', (req, res) => { try { return res.json({ exercise: exercises.get({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, exerciseId: req.params.exerciseId }) }); } catch (e) { return exerciseError(res, e); } });
    router.get('/:bookId/exercises', (req, res) => { try { return res.json({ exercises: exercises.list({ bookId: req.params.bookId, ownerId: req.auth.userId }) }); } catch (e) { return exerciseError(res, e); } });
  }
  if (listen) {
    router.get('/:bookId/listen-framework', (req, res) => { try { return res.json(listen.framework({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.query.revisionId || undefined })); } catch (e) { return frameworkError(res, e); } });
    router.get('/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-content', (req, res) => { try { return res.json({ content: listen.getContent({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId }) }); } catch (e) { return frameworkError(res, e); } });
    router.post('/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-content', async (req, res) => { try { return res.json({ content: await listen.content({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, model: req.body?.model, promptVersion: req.body?.promptVersion, generatorVersion: req.body?.generatorVersion }) }); } catch (e) { return frameworkError(res, e); } });
    router.post('/:bookId/frameworks/:revisionId/nodes/:nodeId/listen-content/:contentId/listen-audio', async (req, res) => { try { return res.json({ audio: await listen.generateAudio({ bookId: req.params.bookId, ownerId: req.auth.userId, revisionId: req.params.revisionId, nodeId: req.params.nodeId, contentId: req.params.contentId, voice: req.body?.voice, rate: req.body?.rate, model: req.body?.model }) }); } catch (e) { if (e.errorCode === 'TTS_FAILED') return res.status(502).json({ error: e.message, errorCode: e.errorCode }); return frameworkError(res, e); } });
    router.get('/:bookId/listen-audio/:audioId', (req, res) => { try { const result = listen.audio({ bookId: req.params.bookId, ownerId: req.auth.userId, audioId: req.params.audioId }); if (req.get('accept')?.includes('application/json')) return res.json({ audio: result.audio }); res.type('audio/mpeg'); return fs.createReadStream(result.row.file_path).pipe(res); } catch (e) { return frameworkError(res, e); } });
  }
  return router;
}

module.exports = { ALLOWED_BOOK_FORMATS, createBookRouter, initBookCore, validateBookFile };
