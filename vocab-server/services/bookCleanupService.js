const fs = require('node:fs');
const path = require('node:path');

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
const MIN_FREE_BYTES = 12 * GiB;

function requiredSpaceBytes(sourceSize, format = 'pdf') {
  const temp = format === 'epub' ? 300 * MiB : ['mobi', 'azw3'].includes(format) ? 500 * MiB : sourceSize * 2;
  return sourceSize + temp + Math.min(sourceSize * 5, GiB) + 512 * MiB;
}
function canAcceptUpload({ availableBytes, uploadBytes, format = 'pdf' }) { return availableBytes >= MIN_FREE_BYTES && availableBytes >= requiredSpaceBytes(uploadBytes, format); }
function createSemaphore(limit = 2) {
  let active = 0; const waiters = [];
  const acquire = () => active < limit ? (active++, Promise.resolve()) : new Promise((resolve) => waiters.push(resolve));
  const release = () => { const next = waiters.shift(); if (next) next(); else active--; };
  return { async run(work) { await acquire(); try { return await work(); } finally { release(); } } };
}
function removeOld(root, maxAgeMs, now = Date.now()) {
  if (!fs.existsSync(root)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name); const stat = fs.statSync(target);
    if (entry.isDirectory()) removed += removeOld(target, maxAgeMs, now);
    if (now - stat.mtimeMs >= maxAgeMs) { fs.rmSync(target, { recursive: true, force: true }); removed++; }
  }
  return removed;
}
function initDeletionQueue(db) { db.exec(`CREATE TABLE IF NOT EXISTS book_deletion_items (id INTEGER PRIMARY KEY AUTOINCREMENT,book_id TEXT NOT NULL,item_type TEXT NOT NULL,item_ref TEXT,status TEXT NOT NULL DEFAULT 'pending',attempt_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(book_id,item_type,item_ref))`); }
function requestDeletion(db, bookId, now = Date.now()) {
  initDeletionQueue(db);
  db.prepare("UPDATE books SET retrieval_disabled=1,delete_requested_at=COALESCE(delete_requested_at,?),deleted_at=COALESCE(deleted_at,?),updated_at=? WHERE id=?").run(now, now, now, bookId);
  const items = [['local', bookId]];
  for (const row of db.prepare('SELECT workflow_run_id FROM framework_revisions WHERE book_id=? AND workflow_run_id IS NOT NULL').all(bookId)) items.push(['dify_run_record', row.workflow_run_id]);
  for (const [type, ref] of items) db.prepare("INSERT OR IGNORE INTO book_deletion_items(book_id,item_type,item_ref,status,created_at,updated_at) VALUES(?,?,?,'pending',?,?)").run(bookId, type, ref, now, now);
}
function removeWithin(root, target) {
  if (!path.isAbsolute(target)) throw new Error('cleanup path must be absolute');
  const base = fs.realpathSync(root);
  const resolved = path.resolve(target);
  if (resolved === base || !resolved.startsWith(`${base}${path.sep}`)) throw new Error('cleanup path outside storage root');
  let existing = resolved;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error('cleanup path has no existing parent');
    existing = parent;
  }
  const realExisting = fs.realpathSync(existing);
  if (realExisting !== base && !realExisting.startsWith(`${base}${path.sep}`)) throw new Error('cleanup path traverses symlink');
  fs.rmSync(resolved, { recursive: true, force: true });
}
function processDeletionQueue(db, storageRoot) {
  initDeletionQueue(db); const items = db.prepare("SELECT * FROM book_deletion_items WHERE status IN ('pending','failed') ORDER BY id").all();
  for (const item of items) try {
    if (item.item_type === 'local') {
      for (const row of db.prepare('SELECT file_path FROM book_revisions WHERE book_id=?').all(item.book_id)) removeWithin(storageRoot, row.file_path);
      for (const row of db.prepare('SELECT file_path FROM book_listen_audio WHERE book_id=?').all(item.book_id)) removeWithin(storageRoot, row.file_path);
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(item.book_id)) throw new Error('invalid book id in deletion queue');
      removeWithin(storageRoot, path.join(storageRoot, 'extracted', item.book_id));
      db.exec('BEGIN IMMEDIATE');
      try {
        const hasTable = (name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
        if (hasTable('knowledge_vault')) {
          const vaultIds = db.prepare("SELECT id FROM knowledge_vault WHERE source=?").all(`book:${item.book_id}`).map((row) => row.id);
          for (const id of vaultIds) { if (hasTable('knowledge_vault_traces')) db.prepare('DELETE FROM knowledge_vault_traces WHERE knowledge_id=?').run(id); if (hasTable('knowledge_vault_revisions')) db.prepare('DELETE FROM knowledge_vault_revisions WHERE knowledge_id=?').run(id); }
          db.prepare('DELETE FROM knowledge_vault WHERE source=?').run(`book:${item.book_id}`);
        }
        if (hasTable('training_attempts')) db.prepare("DELETE FROM training_attempts WHERE json_extract(user_answer,'$.bookId')=?").run(item.book_id);
        db.prepare('DELETE FROM book_exercise_tasks WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM book_exercises WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM book_listen_audio WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM book_listen_contents WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM knowledge_evidence WHERE framework_node_id IN (SELECT id FROM framework_nodes WHERE framework_revision_id IN (SELECT id FROM framework_revisions WHERE book_id=?))').run(item.book_id);
        db.prepare('DELETE FROM framework_nodes WHERE framework_revision_id IN (SELECT id FROM framework_revisions WHERE book_id=?)').run(item.book_id);
        db.prepare('DELETE FROM framework_revisions WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM book_job_steps WHERE job_id IN (SELECT id FROM book_jobs WHERE book_id=?)').run(item.book_id);
        db.prepare('DELETE FROM book_jobs WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM book_chapters WHERE book_revision_id IN (SELECT id FROM book_revisions WHERE book_id=?)').run(item.book_id);
        db.prepare('DELETE FROM chapter_revisions WHERE book_revision_id IN (SELECT id FROM book_revisions WHERE book_id=?)').run(item.book_id);
        db.prepare('DELETE FROM book_source_units WHERE book_revision_id IN (SELECT id FROM book_revisions WHERE book_id=?)').run(item.book_id);
        db.prepare('DELETE FROM book_revisions WHERE book_id=?').run(item.book_id);
        db.prepare('DELETE FROM books WHERE id=?').run(item.book_id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    db.prepare("UPDATE book_deletion_items SET status='completed',updated_at=? WHERE id=?").run(Date.now(), item.id);
  } catch (error) { db.prepare("UPDATE book_deletion_items SET status='failed',attempt_count=attempt_count+1,last_error=?,updated_at=? WHERE id=?").run(error.message, Date.now(), item.id); }
}
function cleanup({ db, storageRoot, now = Date.now(), heavyGate }) {
  const work = () => ({ temp: removeOld(path.join(storageRoot, 'temp'), 2 * 60 * 60_000, now), ocrFailed: removeOld(path.join(storageRoot, 'ocr-failed'), 6 * 60 * 60_000, now), deleted: processDeletionQueue(db, storageRoot) });
  return heavyGate ? heavyGate.run(work) : work();
}
module.exports = { MIN_FREE_BYTES, requiredSpaceBytes, canAcceptUpload, createSemaphore, initDeletionQueue, requestDeletion, processDeletionQueue, cleanup };
