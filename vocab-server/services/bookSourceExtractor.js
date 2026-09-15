const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { inspectAndExtractEpub } = require('./bookEpubExtractor');
const { globalHeavyResourceGate } = require('./heavyResourceGate');

function failure(errorCode, message) { const error = new Error(message); error.errorCode = errorCode; return error; }
function hash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function decodeTxt(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return bytes.subarray(3).toString('utf8');
  if (bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) return bytes.subarray(2).toString('utf16le');
  if (bytes.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) { const swapped = Buffer.from(bytes.subarray(2)); swapped.swap16(); return swapped.toString('utf16le'); }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {}
  for (const encoding of ['gb18030', 'windows-1252']) { try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch {} }
  throw failure('UNSUPPORTED_FORMAT', 'TXT encoding unsupported');
}

function createBookSourceExtractor({ db, outputRoot, calibre, pdfAdapter, ocr, ocrEnabled = true, profile = process.env.BOOK_MVP_PROFILE || 'full', proofreader = async (raw) => raw, gate = globalHeavyResourceGate } = {}) {
  if (!db || !outputRoot) throw new TypeError('db and outputRoot are required');
  const light = profile === 'light'; const maxExpandedChars = 2_000_000;
  async function save(revisionId, unitType, index, raw, corrected, locator, flags = {}) {
    const existing = db.prepare('SELECT * FROM book_source_units WHERE book_revision_id=? AND unit_type=? AND unit_index=?').get(revisionId, unitType, index);
    if (existing?.status === 'completed') return existing;
    const dir = path.join(outputRoot, revisionId, `${unitType}-${index}`); fs.mkdirSync(dir, { recursive: true });
    const rawPath = path.join(dir, 'raw.txt'); const correctedPath = path.join(dir, 'corrected.txt'); const diffPath = path.join(dir, 'diff.json');
    fs.writeFileSync(rawPath, raw); fs.writeFileSync(correctedPath, corrected); fs.writeFileSync(diffPath, JSON.stringify({ changed: raw !== corrected }));
    db.prepare(`INSERT OR IGNORE INTO book_source_units
      (id, book_revision_id, unit_type, unit_index, raw_text_path, corrected_text_path, raw_text_hash,
       corrected_text_hash, correction_diff_path, extractor_version, locator_json, status, flags_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), revisionId, unitType, index, rawPath, correctedPath, hash(raw), hash(corrected), diffPath, '1', JSON.stringify(locator), 'completed', JSON.stringify(flags));
  }
  return { async extract({ revisionId, format, filePath, signal, isCancelled = () => signal?.aborted || false }) {
    if (!['txt', 'epub', 'mobi', 'azw3', 'pdf'].includes(format)) throw failure('UNSUPPORTED_FORMAT', 'Unsupported source format');
    return gate.run(async () => {
      let units; let metadata;
      if (format === 'txt') units = [{ text: decodeTxt(fs.readFileSync(filePath)), locator: { kind: 'sequence', unitIndex: 0 } }];
      else if (format === 'epub') units = await inspectAndExtractEpub(fs.readFileSync(filePath), light ? { maxEntries: 1000, maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 24 * 1024 * 1024, timeoutMs: 20_000 } : {});
      else if (format === 'mobi' || format === 'azw3') {
        if (!calibre) throw failure('CALIBRE_UNAVAILABLE', 'Calibre converter unavailable');
        const converted = await calibre.convert(filePath, path.join(path.dirname(filePath), `${path.basename(filePath)}.epub`)); metadata = converted.metadata;
        units = await inspectAndExtractEpub(fs.readFileSync(converted.outputPath), light ? { maxEntries: 1000, maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 24 * 1024 * 1024, timeoutMs: 20_000 } : {});
      } else {
        if (!pdfAdapter?.pages && !pdfAdapter?.forEachPage) throw failure('PDF_ADAPTER_UNAVAILABLE', 'PDF page adapter unavailable');
        let count = 0;
        const processPage = async (page, index = count) => {
          count = Math.max(count, index + 1);
          if (isCancelled()) throw failure('CANCELLED', 'Extraction cancelled');
          const existing = db.prepare('SELECT * FROM book_source_units WHERE book_revision_id=? AND unit_type=? AND unit_index=?').get(revisionId, 'page', index);
          if (existing?.status === 'completed') return;
          let raw = (page.text || '').trim(); let usedOcr = false;
          if (page.needsOcr || raw.length < 12) {
            if (!ocrEnabled) throw Object.assign(failure('OCR_UNAVAILABLE', '扫描型 PDF 暂缓支持，请上传文本型 PDF 或 EPUB/MOBI/AZW3/TXT'), { retryable: false });
            if (ocr?.recognizePdfPage) raw = await ocr.recognizePdfPage(filePath, index + 1, { signal });
            else if (page.image && ocr?.recognize) raw = await ocr.recognize(page.image, { signal });
            else throw failure('OCR_UNAVAILABLE', 'OCR adapter unavailable');
            usedOcr = true;
          }
          if (isCancelled()) throw failure('CANCELLED', 'Extraction cancelled');
          const locator = { kind: 'page', unitIndex: index, page: index + 1, ...(page.title && { title: page.title, level: page.level || 1 }) };
          const corrected = await proofreader(raw, locator, { signal });
          if (isCancelled()) throw failure('CANCELLED', 'Extraction cancelled');
          await save(revisionId, 'page', index, raw, corrected, locator, { ocr: usedOcr });
        };
        if (pdfAdapter.forEachPage) await pdfAdapter.forEachPage(filePath, processPage, { signal });
        else { const produced = await pdfAdapter.pages(filePath, { signal }); for await (const page of produced) await processPage(page); }
        units = Array.from({ length: count });
      }
      if (format !== 'pdf') {
        if (light && units.reduce((total, unit) => total + unit.text.length, 0) > maxExpandedChars) throw failure('FILE_TOO_LARGE', '轻量版最多支持 2,000,000 个展开字符');
        for (const [index, unit] of units.entries()) {
        if (isCancelled()) throw failure('CANCELLED', 'Extraction cancelled');
        const corrected = await proofreader(unit.text, unit.locator, { signal });
        if (isCancelled()) throw failure('CANCELLED', 'Extraction cancelled');
        await save(revisionId, 'segment', index, unit.text, corrected, unit.locator, { ...unit.flags, conversion: metadata });
        }
      }
      db.prepare(`UPDATE book_revisions SET source_unit_count=(SELECT count(*) FROM book_source_units WHERE book_revision_id=?),
        parser_name=?, parser_version=?, conversion_tool=?, conversion_params_json=? WHERE id=?`).run(
        revisionId, `book-${format}-extractor`, '1', metadata?.tool || null, metadata ? JSON.stringify(metadata) : null, revisionId);
      return { unitCount: units.length, conversion: metadata };
    }, { signal });
  } };
}
module.exports = { createBookSourceExtractor, decodeTxt };
