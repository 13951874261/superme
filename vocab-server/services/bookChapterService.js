const crypto = require('node:crypto');
const fs = require('node:fs');

function transaction(db, work) {
  if (typeof db.transaction === 'function') return db.transaction(work)();
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
function failure(errorCode, message) { const error = new Error(message); error.errorCode = errorCode; return error; }
function parse(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function textOf(unit) { return fs.readFileSync(unit.corrected_text_path || unit.raw_text_path, 'utf8'); }
function titleMatches(text) {
  const pattern = /^(?:第[零〇一二三四五六七八九十百千万0-9]+[章节篇部卷]|chapter\s+\d+|[0-9]+(?:\.[0-9]+)*[、.\s])\s*.+$/i;
  let offset = 0; const matches = [];
  for (const [index, line] of text.split('\n').entries()) {
    const title = line.trim(); if (pattern.test(title)) matches.push({ title, line: index + 1, char: offset + line.indexOf(title) });
    offset += line.length + 1;
  }
  return matches;
}

function createBookChapterService(db) {
  const ownedBook = (bookId, ownerId) => db.prepare("SELECT * FROM books WHERE id=? AND owner_id=? AND deleted_at IS NULL AND status<>'staged'").get(bookId, ownerId);
  const unitsFor = (revisionId) => db.prepare("SELECT * FROM book_source_units WHERE book_revision_id=? AND status='completed' ORDER BY unit_index").all(revisionId);
  function assertJobWritable(jobId) {
    if (!jobId) return;
    const job = db.prepare('SELECT status,cancel_requested_at FROM book_jobs WHERE id=?').get(jobId);
    if (!job || job.status === 'cancelled' || job.cancel_requested_at) throw failure('CANCELLED', 'job cancelled');
  }
  function bounds(unit) {
    const locator = parse(unit.locator_json); const text = textOf(unit);
    if (unit.unit_type === 'page') return { start: { kind: 'page', unitIndex: unit.unit_index, page: locator.page || unit.unit_index + 1 }, end: { kind: 'page', unitIndex: unit.unit_index, page: locator.page || unit.unit_index + 1 } };
    if (unit.resource_path || locator.resource) return { start: { kind: 'resource', unitIndex: unit.unit_index, resourcePath: unit.resource_path || locator.resource, char: 0 }, end: { kind: 'resource', unitIndex: unit.unit_index, resourcePath: unit.resource_path || locator.resource, char: text.length } };
    return { start: { kind: 'text', unitIndex: unit.unit_index, line: locator.startLine || 1, char: locator.startChar || 0 }, end: { kind: 'text', unitIndex: unit.unit_index, line: locator.endLine || text.split('\n').length, char: locator.endChar ?? text.length } };
  }
  function generateCandidates({ bookRevisionId, jobId }) {
    assertJobWritable(jobId);
    const revision = db.prepare('SELECT * FROM book_revisions WHERE id=?').get(bookRevisionId);
    if (!revision) throw failure('NOT_FOUND', 'book revision not found');
    const existing = db.prepare("SELECT * FROM book_chapters WHERE book_revision_id=? AND status='draft' ORDER BY order_index").all(bookRevisionId);
    if (existing.length) return existing;
    const units = unitsFor(bookRevisionId); if (!units.length) throw failure('VALIDATION_ERROR', 'source units missing');
    const candidates = [];
    if (revision.detected_format === 'txt') {
      for (const unit of units) {
        const text = textOf(unit); const found = titleMatches(text); const base = bounds(unit);
        for (const [index, match] of found.entries()) {
          const next = found[index + 1];
          candidates.push({ title: match.title, level: 1, source: 'title', start: { ...base.start, line: match.line, char: match.char }, end: next ? { ...base.end, line: next.line, char: next.char - 1 } : base.end });
        }
      }
    } else if (revision.detected_format === 'pdf') {
      const headings = units.map((unit) => ({ unit, locator: parse(unit.locator_json), title: titleMatches(textOf(unit))[0]?.title })).filter((item) => item.locator.title || item.title);
      if (headings.length) for (const [index, item] of headings.entries()) {
        const next = headings[index + 1]; const start = bounds(item.unit).start; const end = bounds(next ? units[units.findIndex((unit) => unit.id === next.unit.id) - 1] : units.at(-1)).end;
        candidates.push({ title: item.locator.title || item.title, level: Number(item.locator.level) || 1, source: item.locator.title ? 'toc' : 'title', start, end });
      }
    } else {
      for (const unit of units) {
        const locator = parse(unit.locator_json); const text = textOf(unit); const base = bounds(unit);
        candidates.push({ title: locator.title || text.split(/\r?\n/)[0].trim().slice(0, 120) || `第 ${unit.unit_index + 1} 节`, level: Number(locator.level) || 1,
          source: locator.title ? 'toc' : 'spine', start: base.start, end: base.end });
      }
    }
    if (!candidates.length && revision.detected_format === 'pdf') candidates.push({ title: '自动分段 1', level: 1, source: 'auto', start: bounds(units[0]).start, end: bounds(units.at(-1)).end });
    else if (!candidates.length) for (const unit of units) { const base = bounds(unit); candidates.push({ title: `自动分段 ${unit.unit_index + 1}`, level: 1, source: 'auto', start: base.start, end: base.end }); }
    const now = Date.now();
    transaction(db, () => {
      for (const [order, candidate] of candidates.entries()) db.prepare(`INSERT OR IGNORE INTO book_chapters
        (id,book_revision_id,title,level,order_index,start_locator_json,end_locator_json,source,status,version,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?, 'draft',1,?,?)`).run(crypto.randomUUID(), bookRevisionId, candidate.title, candidate.level, order, JSON.stringify(candidate.start), JSON.stringify(candidate.end), candidate.source, now, now);
    });
    return db.prepare("SELECT * FROM book_chapters WHERE book_revision_id=? AND status='draft' ORDER BY order_index").all(bookRevisionId);
  }
  function validateLocator(revisionId, locator) {
    if (!locator || !Number.isInteger(locator.unitIndex)) throw failure('VALIDATION_ERROR', 'locator invalid');
    const unit = db.prepare('SELECT * FROM book_source_units WHERE book_revision_id=? AND unit_index=?').get(revisionId, locator.unitIndex);
    if (!unit) throw failure('VALIDATION_ERROR', 'locator outside source unit boundary');
    const max = bounds(unit).end;
    if (max.kind !== locator.kind) throw failure('VALIDATION_ERROR', 'locator kind mismatch');
    if (locator.kind === 'page' && locator.page !== max.page) throw failure('VALIDATION_ERROR', 'locator outside source unit boundary');
    if (locator.kind === 'resource' && (locator.resourcePath !== max.resourcePath || locator.char < 0 || locator.char > max.char)) throw failure('VALIDATION_ERROR', 'locator resource or boundary invalid');
    if (locator.kind === 'text' && (locator.char < 0 || locator.char > max.char || locator.line < bounds(unit).start.line || locator.line > max.line)) throw failure('VALIDATION_ERROR', 'locator outside source unit boundary');
    return locator;
  }
  function compare(start, end) {
    if (start.unitIndex !== end.unitIndex) return start.unitIndex - end.unitIndex;
    if (start.kind === 'page') return start.page - end.page;
    return start.char - end.char;
  }
  function updateDraft({ bookId, ownerId, chapterId, patch }) {
    if (!ownedBook(bookId, ownerId)) throw failure('NOT_FOUND', 'book not found');
    const row = db.prepare(`SELECT c.* FROM book_chapters c JOIN book_revisions r ON r.id=c.book_revision_id WHERE c.id=? AND r.book_id=?`).get(chapterId, bookId);
    if (!row) throw failure('NOT_FOUND', 'chapter not found'); if (row.status !== 'draft') throw failure('INVALID_STATE', 'chapter is not draft');
    const start = validateLocator(row.book_revision_id, patch.startLocator || parse(row.start_locator_json));
    const end = validateLocator(row.book_revision_id, patch.endLocator || parse(row.end_locator_json));
    if (start.kind !== end.kind || compare(start, end) > 0) throw failure('VALIDATION_ERROR', 'start locator must not exceed end locator');
    if (start.kind === 'resource' && (start.unitIndex !== end.unitIndex || start.resourcePath !== end.resourcePath)) throw failure('VALIDATION_ERROR', 'chapter cannot cross resource boundary');
    const title = patch.title === undefined ? row.title : String(patch.title).trim(); const level = patch.level === undefined ? row.level : Number(patch.level);
    if (!title || !Number.isInteger(level) || level < 1 || level > 5) throw failure('VALIDATION_ERROR', 'title or level invalid');
    db.prepare(`UPDATE book_chapters SET title=?,level=?,start_locator_json=?,end_locator_json=?,version=version+1,updated_at=? WHERE id=? AND status='draft'`)
      .run(title, level, JSON.stringify(start), JSON.stringify(end), Date.now(), row.id);
    return db.prepare('SELECT * FROM book_chapters WHERE id=?').get(row.id);
  }
  function list({ bookId, ownerId }) {
    const book = ownedBook(bookId, ownerId); if (!book) throw failure('NOT_FOUND', 'book not found');
    return db.prepare('SELECT c.* FROM book_chapters c JOIN book_revisions r ON r.id=c.book_revision_id WHERE r.book_id=? ORDER BY c.order_index').all(bookId);
  }
  function validateSet(drafts) {
    if (drafts.some((row, index) => row.order_index !== index)) throw failure('VALIDATION_ERROR', 'chapter order must be unique and continuous');
    let hasGaps = false;
    for (let index = 0; index < drafts.length; index++) {
      const row = drafts[index]; if (row.status === 'migration_error') throw failure('VALIDATION_ERROR', 'migration_error chapter cannot be confirmed');
      const start = validateLocator(row.book_revision_id, parse(row.start_locator_json)); const end = validateLocator(row.book_revision_id, parse(row.end_locator_json));
      if (compare(start, end) > 0) throw failure('VALIDATION_ERROR', 'chapter locator reversed');
      if (index) { const previous = parse(drafts[index - 1].end_locator_json); const relation = compare(previous, start); if (relation >= 0) throw failure('VALIDATION_ERROR', 'chapter overlap'); if (relation < 0) hasGaps = true; }
    }
    return hasGaps;
  }
  function cloneDraft({ bookId, ownerId, revisionId, idempotencyKey }) {
    const book = ownedBook(bookId, ownerId); if (!book) throw failure('NOT_FOUND', 'book not found');
    const source = db.prepare("SELECT * FROM chapter_revisions WHERE id=? AND book_revision_id=? AND status='confirmed'").get(revisionId, book.active_book_revision_id);
    if (!source) throw failure('NOT_FOUND', 'chapter revision not found');
    const existing = db.prepare('SELECT * FROM chapter_revisions WHERE book_revision_id=? AND clone_key=?').get(book.active_book_revision_id, idempotencyKey); if (existing) return existing;
    return transaction(db, () => {
      const id = crypto.randomUUID(); const now = Date.now(); const number = db.prepare('SELECT count(*) n FROM chapter_revisions WHERE book_revision_id=?').get(book.active_book_revision_id).n + 1;
      db.prepare(`INSERT INTO chapter_revisions (id,book_revision_id,revision_number,status,idempotency_key,source_revision_id,clone_key,created_at) VALUES (?,?,?,'draft',?,?,?,?)`)
        .run(id, book.active_book_revision_id, number, `draft:${idempotencyKey}`, revisionId, idempotencyKey, now);
      const rows = db.prepare('SELECT * FROM book_chapters WHERE chapter_revision_id=? ORDER BY order_index').all(revisionId);
      for (const row of rows) db.prepare(`INSERT INTO book_chapters (id,book_revision_id,chapter_revision_id,title,level,order_index,start_locator_json,end_locator_json,source,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'draft',1,?,?)`)
        .run(crypto.randomUUID(), row.book_revision_id, id, row.title, row.level, row.order_index, row.start_locator_json, row.end_locator_json, row.source, now, now);
      return db.prepare('SELECT * FROM chapter_revisions WHERE id=?').get(id);
    });
  }
  function confirm({ bookId, ownerId, idempotencyKey, draftRevisionId = null }) {
    const book = ownedBook(bookId, ownerId); if (!book) throw failure('NOT_FOUND', 'book not found');
    const existing = db.prepare('SELECT * FROM chapter_revisions WHERE book_revision_id=? AND idempotency_key=?').get(book.active_book_revision_id, idempotencyKey);
    if (existing?.status === 'confirmed') return existing;
    const job = db.prepare("SELECT * FROM book_jobs WHERE book_id=? AND job_type='parse' ORDER BY created_at DESC LIMIT 1").get(bookId); assertJobWritable(job?.id);
    return transaction(db, () => {
      const drafts = draftRevisionId
        ? db.prepare("SELECT * FROM book_chapters WHERE chapter_revision_id=? AND status='draft' ORDER BY order_index").all(draftRevisionId)
        : db.prepare("SELECT * FROM book_chapters WHERE book_revision_id=? AND chapter_revision_id IS NULL AND status='draft' ORDER BY order_index").all(book.active_book_revision_id);
      if (!drafts.length) throw failure('INVALID_STATE', 'chapter draft missing'); const hasGaps = validateSet(drafts); const now = Date.now();
      if (draftRevisionId) {
        const target = db.prepare("SELECT * FROM chapter_revisions WHERE id=? AND book_revision_id=? AND status='draft'").get(draftRevisionId, book.active_book_revision_id); if (!target) throw failure('INVALID_STATE', 'draft revision missing');
        db.prepare("UPDATE chapter_revisions SET status='confirmed',idempotency_key=?,has_gaps=?,confirmed_at=? WHERE id=? AND status='draft'").run(idempotencyKey, hasGaps ? 1 : 0, now, target.id);
        db.prepare("UPDATE book_chapters SET status='confirmed',updated_at=? WHERE chapter_revision_id=? AND status='draft'").run(now, target.id);
        return db.prepare('SELECT * FROM chapter_revisions WHERE id=?').get(target.id);
      }
      const revisionNumber = db.prepare('SELECT count(*) n FROM chapter_revisions WHERE book_revision_id=?').get(book.active_book_revision_id).n + 1;
      const id = crypto.randomUUID(); db.prepare(`INSERT INTO chapter_revisions (id,book_revision_id,revision_number,status,idempotency_key,has_gaps,confirmed_at,created_at) VALUES (?,?,?,'confirmed',?,?,?,?)`).run(id, book.active_book_revision_id, revisionNumber, idempotencyKey, hasGaps ? 1 : 0, now, now);
      db.prepare("UPDATE book_chapters SET chapter_revision_id=?,status='confirmed',updated_at=? WHERE book_revision_id=? AND chapter_revision_id IS NULL AND status='draft'").run(id, now, book.active_book_revision_id);
      return db.prepare('SELECT * FROM chapter_revisions WHERE id=?').get(id);
    });
  }
  return { generateCandidates, updateDraft, list, cloneDraft, confirm };
}
module.exports = { createBookChapterService };
