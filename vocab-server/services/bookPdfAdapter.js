const defaultParse = require('pdf-parse');

function loadPdfjs() {
  for (const candidate of ['pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'pdf-parse/lib/pdf.js/v1.10.88/build/pdf.js']) {
    try { return require(candidate); } catch {}
  }
  return null;
}
async function extractOutline(document) {
  const result = [];
  async function walk(items, level) {
    for (const item of items || []) {
      const destination = typeof item.dest === 'string' ? await document.getDestination(item.dest) : item.dest;
      if (destination?.[0]) result.push({ title: String(item.title || '').trim(), level, page: await document.getPageIndex(destination[0]) + 1 });
      await walk(item.items, level + 1);
    }
  }
  await walk(await document.getOutline(), 1);
  return result.filter((item) => item.title);
}
async function openPdf(pdfjs, source, signal) {
  if (!pdfjs?.getDocument) return null;
  pdfjs.disableWorker = true; signal?.throwIfAborted();
  return pdfjs.getDocument(source);
}
function pageData(content) {
  const items = content.items || [];
  const needsOcr = items.some((item) => item.fontName === 'g_font_error');
  return { text: items.map((item) => item.str).join(' '), ...(needsOcr && { needsOcr }) };
}
function createPdfAdapter({ outlineAdapter, pdfjs = loadPdfjs(), parse = defaultParse, readFile } = {}) {
  async function forEachPage(filePath, onPage, { signal } = {}) {
    if (pdfjs?.getDocument && parse === defaultParse) {
      const document = await openPdf(pdfjs, filePath, signal);
      try {
        let outline = []; try { outline = outlineAdapter ? await outlineAdapter(filePath, { signal }) : await extractOutline(document); } catch {}
        const byPage = new Map((outline || []).map((item, order) => [item.page, { title: item.title, level: item.level || 1, tocOrder: order }]));
        for (let number = 1; number <= document.numPages; number++) {
          signal?.throwIfAborted(); const page = await document.getPage(number);
          try { const content = await page.getTextContent(); signal?.throwIfAborted(); await onPage({ ...pageData(content), ...byPage.get(number) }, number - 1); }
          finally { page.cleanup?.(); }
        }
      } finally { try { await document.destroy?.(); } catch {} }
      return;
    }
    const bytes = readFile ? readFile(filePath) : require('node:fs').readFileSync(filePath);
    let outline = [];
    try { const document = await openPdf(pdfjs, bytes, signal); try { outline = outlineAdapter ? await outlineAdapter(filePath, { signal }) : document ? await extractOutline(document) : []; } finally { await document?.destroy?.(); } } catch {}
    const byPage = new Map((outline || []).map((item, order) => [item.page, { title: item.title, level: item.level || 1, tocOrder: order }]));
    let index = 0;
    await parse(bytes, { pagerender: async (page) => { signal?.throwIfAborted(); const content = await page.getTextContent(); await onPage({ ...pageData(content), ...byPage.get(index + 1) }, index++); page.cleanup?.(); return ''; } });
  }
  return { forEachPage };
}
module.exports = { createPdfAdapter, extractOutline, loadPdfjs };
