const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');
const { createBookSourceExtractor, decodeTxt } = require('../services/bookSourceExtractor');
const { validateBookFile } = require('../services/bookService');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-extract-'));
  const rows = [];
  const db = { prepare(sql) { return { get: (...args) => rows.find((r) => r.book_revision_id === args[0] && r.unit_type === args[1] && r.unit_index === args[2]), run: (...args) => { if (/^UPDATE book_revisions/.test(sql.trim())) return { changes: 0 }; rows.push({ id: args[0], book_revision_id: args[1], unit_type: args[2], unit_index: args[3], raw_text_path: args[4], corrected_text_path: args[5], raw_text_hash: args[6], corrected_text_hash: args[7], correction_diff_path: args[8], extractor_version: args[9], locator_json: args[10], status: args[11], flags_json: args[12] }); return { changes: 1 }; } }; } };
  return { root, rows, db, close() { fs.rmSync(root, { recursive: true, force: true }); } };
}

async function epubBytes(toc = 'none') {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
  const tocManifest = toc === 'nav' ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : toc === 'ncx' ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '';
  zip.file('OPS/content.opf', `<package><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="two.xhtml" media-type="application/xhtml+xml"/>${tocManifest}</manifest><spine${toc === 'ncx' ? ' toc="ncx"' : ''}><itemref idref="c2"/><itemref idref="c1"/></spine></package>`);
  zip.file('OPS/one.xhtml', '<html><body><h1>One</h1><p>First</p></body></html>');
  zip.file('OPS/two.xhtml', '<html><body><h1>Two</h1><p>Second</p></body></html>');
  if (toc === 'nav') zip.file('OPS/nav.xhtml', '<html><body><nav epub:type="toc"><ol><li><a href="two.xhtml">第二章</a><ol><li><a href="one.xhtml#x">第一节</a></li></ol></li></ol></nav></body></html>');
  if (toc === 'ncx') zip.file('OPS/toc.ncx', '<ncx><navMap><navPoint><navLabel><text>第二章</text></navLabel><content src="two.xhtml"/><navPoint><navLabel><text>第一节</text></navLabel><content src="one.xhtml#x"/></navPoint></navPoint></navMap></ncx>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('EPUB3 nav 与 NCX 按各自文档目录解析嵌套 href', async () => {
  for (const toc of ['nav', 'ncx']) {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
    const tocItem = toc === 'nav' ? '<item id="toc" href="Nav/nav.xhtml" properties="nav"/>' : '<item id="toc" href="Nav/toc.ncx" media-type="application/x-dtbncx+xml"/>';
    zip.file('OPS/content.opf', `<package><manifest><item id="c" href="Text/c.xhtml"/>${tocItem}</manifest><spine${toc === 'ncx' ? ' toc="toc"' : ''}><itemref idref="c"/></spine></package>`);
    zip.file('OPS/Text/c.xhtml', '<html><body><h1>正文</h1></body></html>');
    zip.file(`OPS/Nav/${toc === 'nav' ? 'nav.xhtml' : 'toc.ncx'}`, toc === 'nav' ? '<html><body><nav><ol><li><a href="../Text/c.xhtml#x">章节C</a></li></ol></nav></body></html>' : '<ncx><navMap><navPoint><navLabel><text>章节C</text></navLabel><content src="../Text/c.xhtml#x"/></navPoint></navMap></ncx>');
    const units = await require('../services/bookEpubExtractor').inspectAndExtractEpub(await zip.generateAsync({ type: 'nodebuffer' }));
    assert.deepEqual([units[0].locator.resource, units[0].locator.title, units[0].flags.tocOrder], ['Text/c.xhtml', '章节C', 0]);
  }
});

test('MOBI 转换为嵌套 TOC EPUB 后继承章节标题', async () => {
  const f = fixture();
  try {
    const converted = path.join(f.root, 'converted.epub'); fs.writeFileSync(converted, await epubBytes('nav'));
    const source = path.join(f.root, 'a.mobi'); fs.writeFileSync(source, 'mobi');
    await createBookSourceExtractor({ db: f.db, outputRoot: f.root, calibre: { convert: async () => ({ outputPath: converted, metadata: {} }) } }).extract({ revisionId: 'mobi', format: 'mobi', filePath: source });
    assert.equal(JSON.parse(f.rows[0].locator_json).title, '第二章');
  } finally { f.close(); }
});

test('五格式写格式中立 locator，正文只落盘', async () => {
  const f = fixture();
  try {
    const converted = path.join(f.root, 'converted.epub');
    fs.writeFileSync(converted, await epubBytes());
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      calibre: { convert: async () => ({ outputPath: converted, metadata: { tool: 'fixture' } }) },
      pdfAdapter: { pages: async () => [{ text: 'PDF page text sufficient' }] } });
    const samples = { txt: Buffer.from('\ufeffTXT text'), epub: await epubBytes(), mobi: Buffer.from('mobi'), azw3: Buffer.from('azw3'), pdf: Buffer.from('%PDF-fixture') };
    for (const [format, bytes] of Object.entries(samples)) {
      const source = path.join(f.root, `source.${format}`); fs.writeFileSync(source, bytes);
      await extractor.extract({ revisionId: `r-${format}`, format, filePath: source });
    }
    assert.equal(f.rows.length, 8);
    for (const row of f.rows) {
      const locator = JSON.parse(row.locator_json);
      assert.equal(typeof locator.unitIndex, 'number');
      assert.equal(typeof locator.kind, 'string');
      assert.equal('format' in locator, false);
      assert.equal(fs.existsSync(row.raw_text_path), true);
      assert.equal('raw_text' in row, false);
    }
    assert.equal(fs.readFileSync(f.rows[0].raw_text_path, 'utf8'), 'TXT text');
    assert.match(fs.readFileSync(f.rows[1].raw_text_path, 'utf8'), /Two Second/);
  } finally { f.close(); }
});

test('扫描 PDF 逐页串行 OCR，并保留 raw corrected diff', async () => {
  const f = fixture(); let active = 0; let maxActive = 0; const order = [];
  try {
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { pages: async () => [{ text: '', image: Buffer.from('1') }, { text: '', image: Buffer.from('2') }] },
      ocr: { recognize: async (image) => { active++; maxActive = Math.max(maxActive, active); order.push(image.toString()); await new Promise((r) => setTimeout(r, 5)); active--; return `raw-${image}`; } },
      proofreader: async (raw) => `${raw}-fixed` });
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    await extractor.extract({ revisionId: 'pdf', format: 'pdf', filePath: source });
    assert.deepEqual(order, ['1', '2']); assert.equal(maxActive, 1);
    for (const row of f.rows) {
      assert.ok(row.raw_text_path); assert.ok(row.corrected_text_path); assert.ok(row.correction_diff_path);
      assert.match(fs.readFileSync(row.corrected_text_path, 'utf8'), /-fixed$/);
    }
  } finally { f.close(); }
});

test('取消立即停止后续写入；重试不破坏已完成 unit', async () => {
  const f = fixture(); let cancelled = false;
  try {
    const options = { db: f.db, outputRoot: f.root, pdfAdapter: { pages: async () => [{ text: 'page one enough' }, { text: 'page two enough' }] } };
    const extractor = createBookSourceExtractor(options);
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    let checks = 0;
    await assert.rejects(extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source, isCancelled: () => ++checks >= 4 }), (e) => e.errorCode === 'CANCELLED');
    assert.equal(f.rows.length, 1);
    await extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source });
    assert.equal(f.rows.length, 2);
    assert.equal(fs.readFileSync(f.rows[0].raw_text_path, 'utf8'), 'page one enough');
  } finally { f.close(); }
});

test('PDF 每页立即持久化，后页失败保留已完成页且重试跳过', async () => {
  const f = fixture(); let fail = true; const calls = [];
  try {
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { pages: async function* () { for (let i = 0; i < 3; i++) { calls.push(i); if (i === 1 && fail) throw new Error('page failed'); yield { text: `page ${i} content enough` }; } } } });
    const source = path.join(f.root, 'partial.pdf'); fs.writeFileSync(source, '%PDF');
    await assert.rejects(extractor.extract({ revisionId: 'partial', format: 'pdf', filePath: source }), /page failed/);
    assert.equal(f.rows.length, 1); fail = false; calls.length = 0;
    await extractor.extract({ revisionId: 'partial', format: 'pdf', filePath: source });
    assert.equal(f.rows.length, 3); assert.deepEqual(calls, [0, 1, 2]);
  } finally { f.close(); }
});

test('取消中止当前 OCR，且不启动第三页', async () => {
  const f = fixture(); const calls = []; let cancelled = false;
  try {
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { pages: async function* () { for (let i = 0; i < 3; i++) yield { text: '', image: Buffer.from(String(i)) }; } },
      ocr: { recognize: async (image, { signal }) => { calls.push(image.toString()); if (image.toString() === '1') { cancelled = true; signal?.throwIfAborted(); } return `ocr page ${image} enough`; } } });
    const source = path.join(f.root, 'cancel.pdf'); fs.writeFileSync(source, '%PDF');
    await assert.rejects(extractor.extract({ revisionId: 'cancel', format: 'pdf', filePath: source, isCancelled: () => cancelled }), (e) => e.errorCode === 'CANCELLED');
    assert.deepEqual(calls, ['0', '1']); assert.equal(f.rows.length, 1);
  } finally { f.close(); }
});

test('暂缓 OCR 时扫描 PDF 立即返回稳定明确错误且不调用 OCR', async () => {
  const f = fixture(); let ocrCalls = 0;
  try {
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    const pdfAdapter = { pages: async () => [{ text: '' }] };
    const ocr = { recognize: async () => { ocrCalls++; return '不应调用'; } };
    await assert.rejects(createBookSourceExtractor({ db: f.db, outputRoot: f.root, pdfAdapter, ocr, ocrEnabled: false }).extract({ revisionId: 'r', format: 'pdf', filePath: source }),
      (e) => e.errorCode === 'OCR_UNAVAILABLE' && e.retryable === false && e.message === '扫描型 PDF 暂缓支持，请上传文本型 PDF 或 EPUB/MOBI/AZW3/TXT');
    assert.equal(ocrCalls, 0); assert.equal(f.rows.length, 0);
  } finally { f.close(); }
});

test('light profile 对 TXT 展开字符快速限流，full profile 保持原行为', async () => {
  const f = fixture();
  try {
    const source = path.join(f.root, 'large.txt'); fs.writeFileSync(source, '中'.repeat(2_000_001));
    await assert.rejects(createBookSourceExtractor({ db: f.db, outputRoot: f.root, profile: 'light' }).extract({ revisionId: 'light', format: 'txt', filePath: source }),
      (error) => error.errorCode === 'FILE_TOO_LARGE');
    await createBookSourceExtractor({ db: f.db, outputRoot: f.root, profile: 'full' }).extract({ revisionId: 'full', format: 'txt', filePath: source });
    assert.equal(f.rows.length, 1);
  } finally { f.close(); }
});

test('扫描 PDF 生产 adapter 与文档 OCR client 组合可逐页得到文字', async () => {
  const f = fixture(); const pages = [];
  try {
    const source = path.join(f.root, 'scan.pdf'); fs.writeFileSync(source, '%PDF');
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { forEachPage: async (_file, onPage) => { await onPage({ text: '' }, 0); await onPage({ text: '' }, 1); } },
      ocr: { recognizePdfPage: async (file, page, { signal }) => { assert.equal(file, source); assert.equal(signal?.aborted, false); pages.push(page); return `OCR page ${page} enough`; } } });
    await extractor.extract({ revisionId: 'scan', format: 'pdf', filePath: source, signal: new AbortController().signal });
    assert.deepEqual(pages, [1, 2]); assert.equal(f.rows.length, 2);
  } finally { f.close(); }
});

test('生产 PDF adapter 每页回调后立即持久，不等待整本解析', async () => {
  const f = fixture(); let rowsAfterFirst;
  try {
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { forEachPage: async (_file, onPage) => { await onPage({ text: 'first page text' }, 0); rowsAfterFirst = f.rows.length; await onPage({ text: 'second page text' }, 1); } } });
    await extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source });
    assert.equal(rowsAfterFirst, 1); assert.equal(f.rows.length, 2);
  } finally { f.close(); }
});

test('PDF 每页立即持久；失败保留前页；相同 input hash 重试跳过 completed', async () => {
  const f = fixture(); let proofreads = 0;
  try {
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { pages: async () => [{ text: 'first page text' }, { text: 'second page text' }] },
      proofreader: async (text) => { proofreads++; if (text.startsWith('second') && proofreads === 2) throw new Error('temporary'); return text; } });
    await assert.rejects(extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source, inputHash: 'hash-a' }));
    assert.equal(f.rows.length, 1);
    await extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source, inputHash: 'hash-a' });
    assert.equal(f.rows.length, 2); assert.equal(proofreads, 3, 'completed first page must be skipped');
  } finally { f.close(); }
});

test('取消信号在 PDF 每页前后及 OCR 内生效，不启动后续页', async () => {
  const f = fixture(); const controller = new AbortController(); let ocrCalls = 0;
  try {
    const source = path.join(f.root, 'a.pdf'); fs.writeFileSync(source, '%PDF');
    const extractor = createBookSourceExtractor({ db: f.db, outputRoot: f.root,
      pdfAdapter: { pages: async () => [{ text: '', image: Buffer.from('1') }, { text: '', image: Buffer.from('2') }] },
      ocr: { recognize: async (_image, { signal }) => { ocrCalls++; assert.equal(signal, controller.signal); controller.abort(); return 'first OCR page'; } } });
    await assert.rejects(extractor.extract({ revisionId: 'r', format: 'pdf', filePath: source, signal: controller.signal }), (e) => e.errorCode === 'CANCELLED');
    assert.equal(ocrCalls, 1); assert.equal(f.rows.length, 0);
  } finally { f.close(); }
});

test('TXT 初筛与 decode 同时接受 BOM、GB18030、Windows-1252，拒绝明显二进制', () => {
  const cases = [
    Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69]),
    Buffer.from([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]),
    Buffer.from([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]),
    Buffer.from([0xd6, 0xd0, 0xce, 0xc4]),
    Buffer.from([0x63, 0x61, 0x66, 0xe9]),
  ];
  for (const bytes of cases) { assert.equal(validateBookFile('txt', bytes).ok, true); assert.ok(decodeTxt(bytes).length > 0); }
  const binary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0xff, 0x00, 0x10]);
  assert.equal(validateBookFile('txt', binary).ok, false);
});
