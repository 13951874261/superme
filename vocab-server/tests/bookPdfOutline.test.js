const assert = require('node:assert/strict');
const test = require('node:test');
const { createPdfAdapter, extractOutline } = require('../services/bookPdfAdapter');

test('PDF.js document outline 递归解析 destination 为页码', async () => {
  const refs = { a: {}, b: {} };
  const document = {
    getOutline: async () => [{ title: '第一章', dest: 'chapter1', items: [{ title: '第一节', dest: [refs.b] }] }],
    getDestination: async (name) => name === 'chapter1' ? [refs.a] : null,
    getPageIndex: async (ref) => ref === refs.a ? 0 : 2,
  };
  assert.deepEqual(await extractOutline(document), [
    { title: '第一章', level: 1, page: 1 }, { title: '第一节', level: 2, page: 3 },
  ]);
});

test('createPdfAdapter 默认生产路径调用内置 PDF.js outline 并映射页面', async () => {
  let outlineCalled = 0; const pages = [];
  const pdfjs = { disableWorker: false, getDocument: async () => ({
    numPages: 2,
    getOutline: async () => { outlineCalled++; return [{ title: '第二章', dest: 'p2', items: [] }]; },
    getDestination: async () => [{ ref: 2 }], getPageIndex: async () => 1,
    destroy() {},
  }) };
  const parse = async (_bytes, options) => {
    await options.pagerender({ getTextContent: async () => ({ items: [{ str: 'page one' }] }) });
    await options.pagerender({ getTextContent: async () => ({ items: [{ str: 'page two' }] }) });
  };
  const adapter = createPdfAdapter({ pdfjs, parse, readFile: () => Buffer.from('%PDF') });
  await adapter.forEachPage('fixture.pdf', (page) => pages.push(page));
  assert.equal(outlineCalled, 1);
  assert.equal(pages[1].title, '第二章'); assert.equal(pages[1].level, 1);
});

test('生产 PDF adapter 以文件路径打开并逐页释放，不读取整本 Buffer', async () => {
  const destroyed = [];
  const document = { numPages: 2, getOutline: async () => [], getPageIndex: async () => 0, getPage: async (number) => ({ getTextContent: async () => ({ items: [{ str: `page ${number}` }] }), cleanup: () => destroyed.push(number) }), destroy() {} };
  let source;
  const adapter = createPdfAdapter({ pdfjs: { getDocument: async (value) => { source = value; return document; } }, readFile: () => { throw new Error('must not read whole PDF'); } });
  const pages = []; await adapter.forEachPage('/tmp/large.pdf', (page) => pages.push(page.text));
  assert.equal(source, '/tmp/large.pdf'); assert.deepEqual(pages, ['page 1', 'page 2']); assert.deepEqual(destroyed, [1, 2]);
});

test('outline 提取失败仅回退正文解析', async () => {
  const pages = [];
  const adapter = createPdfAdapter({ pdfjs: { getDocument: async () => { throw new Error('outline unavailable'); } }, parse: async (_bytes, options) => options.pagerender({ getTextContent: async () => ({ items: [{ str: '正文' }] }) }), readFile: () => Buffer.from('%PDF') });
  await adapter.forEachPage('fixture.pdf', (page) => pages.push(page));
  assert.deepEqual(pages, [{ text: '正文' }]);
});

test('PDF 字体解码失败时标记该页需要 OCR，不能把占位文本当正文', async () => {
  const pages = [];
  const page = { getTextContent: async () => ({ items: [
    { str: 'VISIBLE_PLACEHOLDER', fontName: 'Helvetica' },
    { str: '', fontName: 'g_font_error' }, { str: '', fontName: 'g_font_error' },
  ] }), cleanup() {} };
  const document = { numPages: 1, getOutline: async () => [], getPage: async () => page, destroy() {} };
  await createPdfAdapter({ pdfjs: { getDocument: async () => document } }).forEachPage('fixture.pdf', (value) => pages.push(value));
  assert.equal(pages[0].needsOcr, true);
});
