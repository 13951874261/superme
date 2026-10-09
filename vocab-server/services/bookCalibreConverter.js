const fs = require('node:fs');
const path = require('node:path');
const { safeExecFile } = require('./safeProcess');

function failure(errorCode, message) { const error = new Error(message); error.errorCode = errorCode; return error; }
function inside(root, target) { const relative = path.relative(path.resolve(root), path.resolve(target)); return relative && !relative.startsWith('..') && !path.isAbsolute(relative); }

function createCalibreConverter({ allowedRoot, executable = process.env.EBOOK_CONVERT_PATH || 'ebook-convert', execFile, timeoutMs = 120_000, maxOutputBytes = 100 * 1024 * 1024 } = {}) {
  if (!allowedRoot) throw failure('UNSUPPORTED_FORMAT', 'Calibre allowedRoot is required');
  return { async convert(inputPath, outputPath) {
    if (!inside(allowedRoot, inputPath) || !inside(allowedRoot, outputPath)) throw failure('UNSUPPORTED_FORMAT', 'Calibre path outside allowed root');
    try { await safeExecFile(executable, [inputPath, outputPath], { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, execFile); }
    catch (error) { if (error.cause?.code === 'ENOENT') error.errorCode = 'CALIBRE_UNAVAILABLE'; throw error; }
    let stat; try { stat = fs.statSync(outputPath); } catch { throw failure('UNSUPPORTED_FORMAT', 'Calibre produced no EPUB'); }
    if (stat.size > maxOutputBytes) { fs.rmSync(outputPath, { force: true }); throw failure('FILE_TOO_LARGE', 'Converted EPUB exceeds limit'); }
    return { outputPath, metadata: { tool: 'ebook-convert', inputPath, outputPath, timeoutMs, outputBytes: stat.size } };
  } };
}
module.exports = { createCalibreConverter };
