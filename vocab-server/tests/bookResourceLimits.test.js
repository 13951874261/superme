const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');
const { inspectAndExtractEpub } = require('../services/bookEpubExtractor');
const { createCalibreConverter } = require('../services/bookCalibreConverter');
const { createOcrClient } = require('../services/bookOcrClient');

async function zipWith(name, data, compression = 'DEFLATE') { const zip = new JSZip(); zip.file(name, data, { compression }); return zip.generateAsync({ type: 'nodebuffer' }); }

test('EPUB 拒绝 zip slip、条目超限、单项/总量及压缩比炸弹', async () => {
  const cases = [
    [await zipWith('../escape.xhtml', 'x'), { maxEntries: 10 }],
    [await zipWith('a', 'x'), { maxEntries: 0 }],
    [await zipWith('a', '12345', 'STORE'), { maxEntryBytes: 4 }],
    [await zipWith('a', '12345', 'STORE'), { maxTotalBytes: 4 }],
    [await zipWith('a', 'x'.repeat(10000)), { maxCompressionRatio: 2 }],
  ];
  for (const [bytes, limits] of cases) await assert.rejects(inspectAndExtractEpub(bytes, limits), (e) => e.errorCode === 'FILE_TOO_LARGE');
});

test('EPUB 不解压 spine 中声明为非正文的大二进制资源', async () => {
  const originalLoadAsync = JSZip.loadAsync;
  let binaryAsyncCalls = 0;
  const entry = (name, text, sizes = {}) => ({ name, dir: false, _data: { uncompressedSize: text.length, compressedSize: text.length, ...sizes }, async: async () => text });
  const files = {
    'META-INF/container.xml': entry('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>'),
    'OPS/content.opf': entry('OPS/content.opf', '<package><manifest><item id="cover" href="cover.jpg" media-type="image/jpeg"/><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="cover"/><itemref idref="c"/></spine></package>'),
    'OPS/cover.jpg': { ...entry('OPS/cover.jpg', '', { uncompressedSize: 15 * 1024 * 1024, compressedSize: 15 * 1024 * 1024 }), async: async () => { binaryAsyncCalls++; throw new Error('binary must not be inflated'); } },
    'OPS/c.xhtml': entry('OPS/c.xhtml', '<html><body><p>正文</p></body></html>'),
  };
  JSZip.loadAsync = async () => ({ files, file: (name) => files[name] || null });
  try {
    const units = await inspectAndExtractEpub(Buffer.from('fixture'));
    assert.equal(binaryAsyncCalls, 0);
    assert.equal(units.length, 1);
    assert.equal(units[0].text, '正文');
  } finally { JSZip.loadAsync = originalLoadAsync; }
});

test('EPUB XHTML 正文按 XML 语义解析并支持预取消', async () => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
  zip.file('OPS/content.opf', '<package><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>');
  zip.file('OPS/c.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>正文<br/>下一行</p></body></html>');
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const units = await inspectAndExtractEpub(bytes);
  assert.equal(units[0].text, '正文下一行');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(inspectAndExtractEpub(bytes, { signal: controller.signal }), (error) => error.errorCode === 'CANCELLED');
});

test('EPUB 大型 XHTML 提取正文不对每个顶层元素重复遍历子树', async () => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
  zip.file('OPS/content.opf', '<package><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>');
  const paragraphs = Array.from({ length: 12000 }, (_, index) => `<p>段落${index}</p>`).join('');
  zip.file('OPS/c.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><section>${paragraphs}</section>${paragraphs}</body></html>`);
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  const started = Date.now();
  const units = await inspectAndExtractEpub(bytes, { timeoutMs: 2_000 });
  assert.equal(units.length, 1);
  assert.match(units[0].text, /^段落0/);
  assert.match(units[0].text, /段落11999$/);
  assert.ok(Date.now() - started < 2_000, 'large XHTML extraction exceeded focused budget');
});

test('Calibre 使用 execFile 参数数组、禁 shell，并限制路径/超时/输出大小', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-'));
  try {
    const input = path.join(root, 'a;touch PWN.mobi'); fs.writeFileSync(input, 'x');
    let call;
    const converter = createCalibreConverter({ allowedRoot: root, execFile: async (file, args, options) => { call = { file, args, options }; fs.writeFileSync(args[1], 'epub'); return { stdout: '', stderr: '' }; }, maxOutputBytes: 10 });
    const result = await converter.convert(input, path.join(root, 'out.epub'));
    assert.equal(call.file, 'ebook-convert'); assert.deepEqual(call.args, [input, path.join(root, 'out.epub')]); assert.equal(call.options.shell, false); assert.ok(call.options.timeout);
    assert.equal(result.metadata.inputPath, input);
    await assert.rejects(converter.convert(path.join(root, '..', 'escape.mobi'), path.join(root, 'x.epub')), (e) => e.errorCode === 'UNSUPPORTED_FORMAT');
    const timeout = createCalibreConverter({ allowedRoot: root, execFile: async () => { const e = new Error('timeout'); e.code = 'ETIMEDOUT'; throw e; } });
    await assert.rejects(timeout.convert(input, path.join(root, 't.epub')), (e) => e.errorCode === 'RESOURCE_BUSY');
    const huge = createCalibreConverter({ allowedRoot: root, maxOutputBytes: 2, execFile: async (_f, args) => { fs.writeFileSync(args[1], 'huge'); return {}; } });
    await assert.rejects(huge.convert(input, path.join(root, 'h.epub')), (e) => e.errorCode === 'FILE_TOO_LARGE');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('OCR 文档上传使用文件 Blob，不把整本 PDF 读入内存', async () => {
  const { createOcrClient } = require('../services/bookOcrClient');
  let opened = 0; let uploaded;
  const responses = [
    { ok: true, json: async () => ({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }) },
    { ok: true, json: async () => ({ code: 100, data: 'task' }) },
    { ok: true, json: async () => ({ code: 100, is_done: true, state: 'success', data: 'text' }) },
    { ok: true, json: async () => ({ code: 100 }) },
  ];
  const client = createOcrClient({ endpoint: 'http://127.0.0.1:1224', openFileAsBlob: async () => { opened++; return new Blob(['pdf']); }, fetch: async (_url, options = {}) => { if (options.body instanceof FormData) uploaded = options.body; return responses.shift(); } });
  assert.equal(await client.recognizePdfPage('/tmp/large.pdf', 3), 'text'); assert.equal(opened, 1); assert.ok(uploaded instanceof FormData);
});

test('OCR 默认取 UMI_OCR_URL、仅允许回环地址并透传取消信号', async () => {
  const previous = process.env.UMI_OCR_URL;
  process.env.UMI_OCR_URL = 'http://127.0.0.1:1224/api/ocr';
  try {
    assert.throws(() => createOcrClient({ endpoint: 'http://example.com/api' }), (e) => e.errorCode === 'OCR_UNAVAILABLE');
    const controller = new AbortController(); let received;
    const client = createOcrClient({ fetch: async (_url, options) => { received = options.signal; return { ok: true, json: async () => ({ text: 'ok' }) }; } });
    assert.equal(await client.recognize(Buffer.from('page'), { signal: controller.signal }), 'ok');
    assert.equal(received, controller.signal);
  } finally {
    if (previous === undefined) delete process.env.UMI_OCR_URL; else process.env.UMI_OCR_URL = previous;
  }
});

test('Calibre 取 EBOOK_CONVERT_PATH，缺失二进制返回稳定错误', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-path-'));
  const previous = process.env.EBOOK_CONVERT_PATH;
  process.env.EBOOK_CONVERT_PATH = 'custom-ebook-convert';
  try {
    const input = path.join(root, 'a.mobi'); const output = path.join(root, 'a.epub'); fs.writeFileSync(input, 'x');
    let executable;
    const converter = createCalibreConverter({ allowedRoot: root, execFile: async (file) => { executable = file; const error = new Error('missing'); error.code = 'ENOENT'; throw error; } });
    await assert.rejects(converter.convert(input, output), (e) => e.errorCode === 'CALIBRE_UNAVAILABLE');
    assert.equal(executable, 'custom-ebook-convert');
  } finally {
    if (previous === undefined) delete process.env.EBOOK_CONVERT_PATH; else process.env.EBOOK_CONVERT_PATH = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
