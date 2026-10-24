const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const JSZip = require('jszip');
const { createPdfAdapter } = require('../services/bookPdfAdapter');
const { inspectAndExtractEpub } = require('../services/bookEpubExtractor');

const root = path.resolve(__dirname, '..', '..');
const outputDir = path.join(root, 'private', 'book-mvp-fixtures');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const syntheticNotice = 'SYNTHETIC ORIGINAL TEST CONTENT — generated for technical validation; no copyrighted source material.';
const chapters = [
  ['Chapter 1 - Signals', 'A quiet observatory records a blue pulse every eleven minutes. The team separates measurement from interpretation and preserves each timestamp.'],
  ['Chapter 2 - Models', 'A model named Lantern predicts the next pulse from three prior intervals. Its assumptions are written beside every result so another reader can reproduce the calculation.'],
  ['Chapter 3 - Decisions', 'The operators compare waiting, recalibrating, and collecting a second sensor reading. They choose the reversible action while uncertainty remains high.'],
  ['Chapter 4 - Revision', 'New observations contradict one coefficient. The team updates only that coefficient, repeats the check, and records why the revision changed the forecast.'],
  ['Chapter 5 - Transfer', 'A second observatory applies the method to green pulses. The procedure transfers, but the old coefficient does not, showing the boundary of the original model.'],
  ['Chapter 6 - Reflection', 'The final log distinguishes evidence, inference, and decision. This separation makes later review faster and prevents confidence from replacing verification.'],
];

function pdfEscape(value) { return value.replace(/([\\()])/g, '\\$1'); }
function buildPdf() {
  const objects = new Map();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R /PageMode /UseOutlines >>');
  objects.set(2, `<< /Type /Pages /Kids [${chapters.slice(0, 4).map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count 4 >>`);
  objects.set(3, '<< /Type /Outlines /First 12 0 R /Last 15 0 R /Count 4 >>');
  chapters.slice(0, 4).forEach(([title, body], index) => {
    const pageId = 4 + index * 2; const streamId = pageId + 1; const outlineId = 12 + index;
    const stream = `BT /F1 18 Tf 72 740 Td (${pdfEscape(title)}) Tj 0 -34 Td /F1 10 Tf (${pdfEscape(syntheticNotice)}) Tj 0 -28 Td (${pdfEscape(body)}) Tj ET`;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 16 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.set(streamId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    objects.set(outlineId, `<< /Title (${pdfEscape(title)}) /Parent 3 0 R ${index ? `/Prev ${outlineId - 1} 0 R ` : ''}${index < 3 ? `/Next ${outlineId + 1} 0 R ` : ''}/Dest [${pageId} 0 R /Fit] >>`);
  });
  objects.set(16, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let id = 1; id <= 16; id++) { offsets[id] = Buffer.byteLength(pdf); pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 17\n0000000000 65535 f \n`;
  for (let id = 1; id <= 16; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size 17 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

async function buildEpub() {
  const zip = new JSZip(); const date = new Date('2026-01-01T00:00:00Z'); const add = (name, data, options = {}) => zip.file(name, data, { date, ...options });
  add('mimetype', 'application/epub+zip', { compression: 'STORE' });
  add('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const manifest = chapters.map((_, i) => `<item id="c${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('');
  const spine = chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('');
  add('OPS/package.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:synthetic-book-mvp</dc:identifier><dc:title>Synthetic Observatory Handbook</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest}</manifest><spine>${spine}</spine></package>`);
  add('OPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>${chapters.map(([title], i) => `<li><a href="chapter-${i + 1}.xhtml">${title}</a></li>`).join('')}</ol></nav></body></html>`);
  chapters.forEach(([title, body], i) => add(`OPS/chapter-${i + 1}.xhtml`, `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body><h1>${title}</h1><p>${syntheticNotice}</p><p>${body}</p><p>${body} This repeated synthetic paragraph provides enough content for realistic extraction without inflating the fixture.</p></body></html>`));
  Object.values(zip.files).forEach((entry) => { entry.date = date; });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' });
}

function buildTxt() {
  return Buffer.from(chapters.slice(0, 4).map(([title, body], i) => `第${['一', '二', '三', '四'][i]}章 ${title.split(' - ')[1]}\n${syntheticNotice}\n${body}\n这是完全原创的合成段落，用于验证 UTF-8 解码、章节边界和原文证据定位。\n`).join('\n'), 'utf8');
}
function evidenceFor(id, unitIndex, text, quote, extra = {}) { const start = text.indexOf(quote); assert.ok(start >= 0); return { id: `${id}-evidence`, unitIndex, locator: { ...extra, unitIndex, charStart: start, charEnd: start + quote.length - 1 }, quote, quoteHash: sha256(quote), sourceTextHash: sha256(text) }; }

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = { pdf: path.join(outputDir, 'synthetic-observatory.pdf'), epub: path.join(outputDir, 'synthetic-observatory.epub'), txt: path.join(outputDir, 'synthetic-observatory.txt') };
  fs.writeFileSync(files.pdf, buildPdf()); fs.writeFileSync(files.epub, await buildEpub()); fs.writeFileSync(files.txt, buildTxt());
  const started = performance.now(); const rssStart = process.memoryUsage().rss; let rssPeak = rssStart;
  const pdfUnits = []; await createPdfAdapter().forEachPage(files.pdf, (unit, index) => { pdfUnits.push({ text: unit.text.trim(), locator: { kind: 'page', unitIndex: index, pageIndex: index, title: unit.title } }); rssPeak = Math.max(rssPeak, process.memoryUsage().rss); });
  const epubUnits = await inspectAndExtractEpub(fs.readFileSync(files.epub)); rssPeak = Math.max(rssPeak, process.memoryUsage().rss);
  const txt = fs.readFileSync(files.txt, 'utf8'); const txtMatches = [...txt.matchAll(/^第[一二三四]章\s+.+$/gm)];
  assert.equal(pdfUnits.length, 4); assert.deepEqual(pdfUnits.map((u) => u.locator.title), chapters.slice(0, 4).map((c) => c[0]));
  assert.equal(epubUnits.length, 6); assert.deepEqual(epubUnits.map((u) => u.locator.title), chapters.map((c) => c[0])); assert.equal(txtMatches.length, 4);
  assert.ok(fs.statSync(files.txt).size <= 20 * 1024 * 1024 && txt.length <= 2_000_000);
  const gold = { schemaVersion: 1, synthetic: true, copyrightStatus: 'original_synthetic_no_third_party_copyright', generatedBy: 'vocab-server/scripts/generate-book-mvp-fixtures.js', samples: [
    { id: 'synthetic-pdf', format: 'pdf', file: path.basename(files.pdf), sha256: sha256(fs.readFileSync(files.pdf)), expectedChapters: pdfUnits.map((u, i) => ({ title: u.locator.title, startLocator: { kind: 'page', unitIndex: i, pageIndex: i }, endLocator: { kind: 'page', unitIndex: i, pageIndex: i } })), evidence: [evidenceFor('pdf', 0, pdfUnits[0].text, 'quiet observatory', { kind: 'page', pageIndex: 0 })] },
    { id: 'synthetic-epub', format: 'epub', file: path.basename(files.epub), sha256: sha256(fs.readFileSync(files.epub)), expectedChapters: epubUnits.map((u, i) => ({ title: u.locator.title, startLocator: { kind: 'resource', unitIndex: i, resourcePath: u.locator.resource, char: 0 }, endLocator: { kind: 'resource', unitIndex: i, resourcePath: u.locator.resource, char: u.text.length } })), evidence: [evidenceFor('epub', 1, epubUnits[1].text, 'model named Lantern', { kind: 'resource', resourcePath: epubUnits[1].locator.resource })] },
    { id: 'synthetic-txt', format: 'txt', file: path.basename(files.txt), sha256: sha256(fs.readFileSync(files.txt)), expectedChapters: txtMatches.map((match, i) => ({ title: match[0], startLocator: { kind: 'text', unitIndex: 0, line: txt.slice(0, match.index).split('\n').length, char: match.index }, endLocator: { kind: 'text', unitIndex: 0, line: txt.slice(0, txtMatches[i + 1]?.index ?? txt.length).split('\n').length, char: (txtMatches[i + 1]?.index ?? txt.length) - 1 } })), evidence: [evidenceFor('txt', 0, txt, '这是完全原创的合成段落', { kind: 'text' })] }
  ] };
  fs.writeFileSync(path.join(outputDir, 'gold.json'), `${JSON.stringify(gold, null, 2)}\n`);
  const reviews = { schemaVersion: 1, status: 'pending_human_review', synthetic: true, reviewer: null, secondReviewer: null, adjudicator: null, reviewedAt: null, approvals: { product: false, engineering: false }, samples: gold.samples.map(({ id }) => ({ id, status: 'pending_human_review', chapterBoundaryReview: null, evidenceReview: null, severeHallucinations: null, notes: null })) };
  fs.writeFileSync(path.join(outputDir, 'reviews.template.json'), `${JSON.stringify(reviews, null, 2)}\n`);
  const metrics = { elapsedMs: Math.round(performance.now() - started), rssStartBytes: rssStart, rssPeakBytes: rssPeak, rssDeltaBytes: rssPeak - rssStart, extractedChars: { pdf: pdfUnits.reduce((n, u) => n + u.text.length, 0), epub: epubUnits.reduce((n, u) => n + u.text.length, 0), txt: txt.length }, chapterCounts: { pdf: pdfUnits.length, epub: epubUnits.length, txt: txtMatches.length } };
  console.log(JSON.stringify({ outputDir, files: Object.fromEntries(Object.entries(files).map(([format, file]) => [format, { path: file, sizeBytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) }])), evidenceValidated: gold.samples.map((sample) => ({ id: sample.id, quoteHashMatches: sample.evidence.every((e) => e.quoteHash === sha256(e.quote)) })), metrics }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
