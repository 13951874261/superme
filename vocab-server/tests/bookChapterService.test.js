const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { initBookCore } = require('../services/bookService');
const { createBookChapterService } = require('../services/bookChapterService');

function fixture(format = 'txt') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-chapters-'));
  const db = new Database(path.join(root, 'test.db'));
  initBookCore(db);
  const now = Date.now();
  db.prepare(`INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at)
    VALUES ('book','alice','A','a.txt','parsing','revision',?,?)`).run(now, now);
  db.prepare(`INSERT INTO book_revisions
    (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,detected_format,status,created_at)
    VALUES ('revision','book','alice','hash','a.txt',1,?,?, 'parsing',?)`).run(format, format, now);
  db.prepare(`INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,created_at)
    VALUES ('job','book','alice','parse','running','source_extraction','hash',?)`).run(now);
  return {
    db, root, chapters: createBookChapterService(db),
    unit(index, text, locator, resourcePath = null) {
      const file = path.join(root, `${index}.txt`); fs.writeFileSync(file, text);
      db.prepare(`INSERT INTO book_source_units
        (id,book_revision_id,unit_type,unit_index,resource_path,raw_text_path,corrected_text_path,locator_json,status)
        VALUES (?,?,?,?,?,?,?,?, 'completed')`).run(`unit-${index}`, 'revision', format === 'pdf' ? 'page' : 'segment', index, resourcePath, file, file, JSON.stringify(locator));
    },
    close() { db.close(); fs.rmSync(root, { recursive: true, force: true }); },
  };
}

test('初始化完整且幂等的章节表迁移', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-chapter-migration-'));
  const db = new Database(path.join(root, 'test.db'));
  try {
    db.exec(`CREATE TABLE books (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, original_file_name TEXT NOT NULL, status TEXT NOT NULL, active_book_revision_id TEXT, active_framework_revision_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, delete_requested_at INTEGER, deleted_at INTEGER);
      CREATE TABLE book_chapters (id TEXT PRIMARY KEY, book_id TEXT, title TEXT)`);
    db.prepare("INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at) VALUES ('mapped','alice','A','a','active','rev',1,1)").run();
    db.prepare('INSERT INTO book_chapters VALUES (?,?,?)').run('legacy-mapped', 'mapped', '旧章节');
    db.prepare('INSERT INTO book_chapters VALUES (?,?,?)').run('legacy-orphan', 'missing', '孤儿章节');
    initBookCore(db); initBookCore(db);
    const chapterColumns = db.prepare('PRAGMA table_info(book_chapters)').all().map((column) => column.name);
    for (const name of ['id', 'book_revision_id', 'title', 'level', 'order_index', 'start_locator_json', 'end_locator_json', 'source', 'status', 'version', 'created_at', 'updated_at']) assert.ok(chapterColumns.includes(name), name);
    for (const table of ['chapter_revisions', 'book_chapters']) assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name=?").get(table).n, 1);
    assert.equal(db.prepare("SELECT book_revision_id FROM book_chapters WHERE id='legacy-mapped'").get().book_revision_id, 'rev');
    assert.equal(db.prepare("SELECT status FROM book_chapters WHERE id='legacy-orphan'").get().status, 'migration_error');
    assert.equal(db.prepare('SELECT count(*) n FROM book_chapters').get().n, 2);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('TXT 标题生成候选并保留行号与字符区间', () => {
  const f = fixture();
  try {
    f.unit(0, '第一章 开始\n正文一\n第二章 方法\n正文二', { kind: 'text', startLine: 1, endLine: 4, startChar: 0, endChar: 20 });
    const rows = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.deepEqual(rows.map((row) => [row.title, row.source]), [['第一章 开始', 'title'], ['第二章 方法', 'title']]);
    assert.deepEqual(JSON.parse(rows[0].start_locator_json), { kind: 'text', unitIndex: 0, line: 1, char: 0 });
    assert.deepEqual(JSON.parse(rows[1].start_locator_json), { kind: 'text', unitIndex: 0, line: 3, char: 11 });
  } finally { f.close(); }
});

test('PDF 优先书签标题，EPUB 类优先 resource_path 与 spine 顺序', () => {
  const pdf = fixture('pdf');
  try {
    pdf.unit(0, 'Preface', { kind: 'page', unitIndex: 0, page: 1, title: '序言', level: 1 });
    pdf.unit(1, 'Body', { kind: 'page', unitIndex: 1, page: 2 });
    const rows = pdf.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.equal(rows[0].title, '序言'); assert.equal(rows[0].source, 'toc');
    assert.deepEqual(JSON.parse(rows[0].start_locator_json), { kind: 'page', unitIndex: 0, page: 1 });
  } finally { pdf.close(); }

  const epub = fixture('epub');
  try {
    epub.unit(0, 'Opening', { kind: 'sequence', unitIndex: 0, resource: 'Text/a.xhtml', title: '开篇' }, 'Text/a.xhtml');
    epub.unit(1, 'Second', { kind: 'sequence', unitIndex: 1, resource: 'Text/b.xhtml' }, 'Text/b.xhtml');
    const rows = epub.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.deepEqual(rows.map((row) => [row.title, JSON.parse(row.start_locator_json).resourcePath]), [['开篇', 'Text/a.xhtml'], ['Second', 'Text/b.xhtml']]);
  } finally { epub.close(); }
});

test('无可靠目录标记自动分段且生成操作幂等', () => {
  const f = fixture();
  try {
    f.unit(0, '没有标题的短文本', { kind: 'text', startLine: 1, endLine: 1, startChar: 0, endChar: 8 });
    const first = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    const second = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.equal(first.length, 1); assert.equal(first[0].source, 'auto'); assert.equal(second[0].id, first[0].id);
  } finally { f.close(); }
});

test('草稿边界必须在 source unit 内且禁止跨非法 resource', () => {
  const f = fixture('epub');
  try {
    f.unit(0, 'abcdefghij', { kind: 'sequence', unitIndex: 0, resource: 'a.xhtml' }, 'a.xhtml');
    f.unit(1, 'klmnopqrst', { kind: 'sequence', unitIndex: 1, resource: 'b.xhtml' }, 'b.xhtml');
    const [chapter] = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.throws(() => f.chapters.updateDraft({ bookId: 'book', ownerId: 'alice', chapterId: chapter.id,
      patch: { startLocator: { kind: 'resource', unitIndex: 0, resourcePath: 'a.xhtml', char: 8 }, endLocator: { kind: 'resource', unitIndex: 0, resourcePath: 'a.xhtml', char: 2 } } }), /start locator must not exceed end locator/);
    assert.throws(() => f.chapters.updateDraft({ bookId: 'book', ownerId: 'alice', chapterId: chapter.id,
      patch: { endLocator: { kind: 'resource', unitIndex: 0, resourcePath: 'b.xhtml', char: 2 } } }), /resource/);
    assert.throws(() => f.chapters.updateDraft({ bookId: 'book', ownerId: 'alice', chapterId: chapter.id,
      patch: { endLocator: { kind: 'resource', unitIndex: 0, resourcePath: 'a.xhtml', char: 99 } } }), /boundary/);
  } finally { f.close(); }
});

test('PDF 无 outline 时按标题页合并连续页面而非每页一章', () => {
  const f = fixture('pdf');
  try {
    f.unit(0, '第一章 开始\n第一页', { kind: 'page', unitIndex: 0, page: 1 });
    f.unit(1, '继续内容', { kind: 'page', unitIndex: 1, page: 2 });
    f.unit(2, '第二章 方法\n第三页', { kind: 'page', unitIndex: 2, page: 3 });
    const rows = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.deepEqual(rows.map((row) => [row.title, JSON.parse(row.start_locator_json).page, JSON.parse(row.end_locator_json).page]), [['第一章 开始', 1, 2], ['第二章 方法', 3, 3]]);
  } finally { f.close(); }
});

test('PDF 完全无标题时合并为单个自动章节', () => {
  const f = fixture('pdf');
  try {
    f.unit(0, '普通正文第一页', { kind: 'page', unitIndex: 0, page: 1 });
    f.unit(1, '普通正文第二页', { kind: 'page', unitIndex: 1, page: 2 });
    const rows = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    assert.equal(rows.length, 1); assert.equal(rows[0].source, 'auto'); assert.equal(JSON.parse(rows[0].end_locator_json).page, 2);
  } finally { f.close(); }
});

test('确认前拒绝序号空缺和章节重叠，允许来源 gap 并标记', () => {
  const f = fixture();
  try {
    f.unit(0, '第一章 A\naaaa\n第二章 B\nbbbb', { kind: 'text', startLine: 1, endLine: 4, startChar: 0, endChar: 21 });
    const rows = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    f.db.prepare('UPDATE book_chapters SET order_index=2 WHERE id=?').run(rows[1].id);
    assert.throws(() => f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'bad-order' }), /continuous/);
    f.db.prepare('UPDATE book_chapters SET order_index=1,start_locator_json=? WHERE id=?').run(JSON.stringify({ kind: 'text', unitIndex: 0, line: 2, char: 5 }), rows[1].id);
    assert.throws(() => f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'overlap' }), /overlap/);
    f.db.prepare('UPDATE book_chapters SET start_locator_json=? WHERE id=?').run(JSON.stringify({ kind: 'text', unitIndex: 0, line: 4, char: 17 }), rows[1].id);
    const revision = f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'gap' });
    assert.equal(revision.has_gaps, 1);
  } finally { f.close(); }
});

test('confirmed revision 幂等克隆新 draft，新确认不修改旧快照', () => {
  const f = fixture();
  try {
    f.unit(0, '第一章\n正文', { kind: 'text', startLine: 1, endLine: 2, startChar: 0, endChar: 7 });
    f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    const first = f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'confirm-1' });
    const draftA = f.chapters.cloneDraft({ bookId: 'book', ownerId: 'alice', revisionId: first.id, idempotencyKey: 'clone-1' });
    const draftB = f.chapters.cloneDraft({ bookId: 'book', ownerId: 'alice', revisionId: first.id, idempotencyKey: 'clone-1' });
    assert.equal(draftA.id, draftB.id);
    const draftChapter = f.db.prepare("SELECT * FROM book_chapters WHERE chapter_revision_id=?").get(draftA.id);
    f.chapters.updateDraft({ bookId: 'book', ownerId: 'alice', chapterId: draftChapter.id, patch: { title: '新版标题' } });
    const second = f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'confirm-2', draftRevisionId: draftA.id });
    assert.notEqual(second.id, first.id);
    assert.equal(f.db.prepare('SELECT title FROM book_chapters WHERE chapter_revision_id=?').get(first.id).title, '自动分段 1');
    assert.equal(f.db.prepare('SELECT title FROM book_chapters WHERE chapter_revision_id=?').get(second.id).title, '新版标题');
  } finally { f.close(); }
});

test('确认创建不可变 revision，重复确认幂等，取消后拒绝写', () => {
  const f = fixture();
  try {
    f.unit(0, '第一章\n正文', { kind: 'text', startLine: 1, endLine: 2, startChar: 0, endChar: 7 });
    const [draft] = f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' });
    const confirmed = f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'confirm-1' });
    const repeated = f.chapters.confirm({ bookId: 'book', ownerId: 'alice', idempotencyKey: 'confirm-1' });
    assert.equal(repeated.id, confirmed.id);
    assert.equal(f.db.prepare("SELECT count(*) n FROM chapter_revisions WHERE status='confirmed'").get().n, 1);
    assert.throws(() => f.chapters.updateDraft({ bookId: 'book', ownerId: 'alice', chapterId: draft.id, patch: { title: '改名' } }), /draft/);

    f.db.prepare("UPDATE book_jobs SET status='cancelled',cancel_requested_at=1 WHERE id='job'").run();
    assert.throws(() => f.chapters.generateCandidates({ bookRevisionId: 'revision', jobId: 'job' }), /cancelled/);
  } finally { f.close(); }
});
