const path = require('node:path');
const { openAsBlob } = require('node:fs');

function failure(message, cause) { const error = new Error(message); error.errorCode = 'OCR_UNAVAILABLE'; error.retryable = true; error.cause = cause; return error; }
function sleep(ms, signal) { return new Promise((resolve, reject) => { const timer = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason || new DOMException('Aborted', 'AbortError')); }, { once: true }); }); }

function createOcrClient({ endpoint = process.env.UMI_OCR_URL, fetch: fetchImpl = globalThis.fetch, openFileAsBlob = openAsBlob, pollMs = 500, timeoutMs = 30_000, clearTimeoutMs = 2000 } = {}) {
  let url; try { url = new URL(endpoint); } catch { throw failure('OCR endpoint is required'); }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) throw failure('OCR endpoint must be loopback');
  const base = new URL(url.pathname.startsWith('/api/') ? '/' : url.pathname, url);
  const apiUrl = (pathname) => new URL(pathname, base);

  async function json(response, operation) {
    if (!response.ok) throw new Error(`${operation} HTTP ${response.status}`);
    return response.json();
  }
  async function recognize(image, { signal } = {}) {
    try {
      const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: image, signal: signal || AbortSignal.timeout(timeoutMs) });
      const body = await json(response, 'OCR');
      if (typeof body.text !== 'string') throw new Error('OCR response missing text');
      return body.text;
    } catch (cause) { if (cause?.name === 'AbortError' && signal?.aborted) throw cause; throw failure('OCR service unavailable', cause); }
  }
  async function recognizePdfPage(filePath, pageNumber, { signal } = {}) {
    let taskId;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    try {
      const options = await json(await fetchImpl(apiUrl('/api/doc/get_options'), { signal: requestSignal }), 'OCR options');
      if (!options || typeof options !== 'object' || Array.isArray(options)
        || !['pageRangeStart', 'pageRangeEnd', 'pageList'].every((key) => options[key] && typeof options[key] === 'object')) {
        throw new Error('OCR options response incompatible');
      }
      const form = new FormData();
      form.append('file', await openFileAsBlob(filePath, { type: 'application/pdf' }), path.basename(filePath));
      form.append('json', JSON.stringify({ pageRangeStart: pageNumber, pageRangeEnd: pageNumber, pageList: [pageNumber], 'doc.extractionMode': 'fullPage' }));
      const upload = await json(await fetchImpl(apiUrl('/api/doc/upload'), { method: 'POST', body: form, signal: requestSignal }), 'OCR upload');
      if (upload.code !== 100 || typeof upload.data !== 'string' || !upload.data) throw new Error(`OCR upload failed: ${upload.data || upload.code}`);
      taskId = upload.data;
      for (;;) {
        requestSignal.throwIfAborted();
        const result = await json(await fetchImpl(apiUrl('/api/doc/result'), { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: taskId, is_data: true, is_unread: false, format: 'text' }), signal: requestSignal }), 'OCR result');
        if (result.code !== 100 || typeof result.is_done !== 'boolean' || typeof result.state !== 'string') throw new Error('OCR result response incompatible');
        if (result.is_done) {
          if (result.state !== 'success' || typeof result.data !== 'string') throw new Error(result.message || 'OCR result failed or incompatible');
          return result.data;
        }
        if (!['waiting', 'running'].includes(result.state)) throw new Error('OCR result state incompatible');
        await sleep(pollMs, requestSignal);
      }
    } catch (cause) {
      if (cause?.name === 'AbortError' && signal?.aborted) throw cause;
      throw failure('OCR service unavailable', cause);
    } finally {
      if (taskId) {
        const clearController = new AbortController();
        const timeout = setTimeout(() => clearController.abort(), clearTimeoutMs);
        const aborted = signal?.aborted ? Promise.resolve() : new Promise((resolve) => signal?.addEventListener('abort', resolve, { once: true }));
        try {
          await Promise.race([
            fetchImpl(apiUrl(`/api/doc/clear/${encodeURIComponent(taskId)}`), { signal: clearController.signal }),
            new Promise((resolve) => clearController.signal.addEventListener('abort', resolve, { once: true })),
            aborted,
          ]);
        } catch {} finally { clearTimeout(timeout); }
      }
    }
  }
  return { recognize, recognizePdfPage };
}
module.exports = { createOcrClient };
