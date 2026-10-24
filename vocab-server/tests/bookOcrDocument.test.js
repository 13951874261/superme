const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createOcrClient } = require('../services/bookOcrClient');

async function fixture(handler) {
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      if (error?.code !== 'ECONNRESET') throw error;
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { endpoint: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

function readBody(req) { return new Promise((resolve, reject) => { const chunks = []; req.on('data', (chunk) => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); }); }

function tempPdf() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'umi-doc-')); const file = path.join(root, 'scan.pdf'); fs.writeFileSync(file, '%PDF-test'); return { file, close: () => fs.rmSync(root, { recursive: true, force: true }) }; }

test('recognizePdfPage 使用真实 multipart 单页上传、轮询 text 结果并清理', async () => {
  const requests = []; let polls = 0;
  const api = await fixture(async (req, res) => {
    const body = await readBody(req); requests.push({ url: req.url, method: req.method, type: req.headers['content-type'], body });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/doc/get_options') return res.end(JSON.stringify({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }));
    if (req.url === '/api/doc/upload') return res.end(JSON.stringify({ code: 100, data: 'task-1' }));
    if (req.url === '/api/doc/result') return res.end(JSON.stringify(++polls === 1
      ? { code: 100, is_done: false, state: 'running', data: [] }
      : { code: 100, is_done: true, state: 'success', data: 'page text' }));
    if (req.url === '/api/doc/clear/task-1') return res.end(JSON.stringify({ code: 100, data: 'ok' }));
    res.statusCode = 404; res.end('{}');
  });
  const pdf = tempPdf();
  try {
    const text = await createOcrClient({ endpoint: api.endpoint, pollMs: 1 }).recognizePdfPage(pdf.file, 3);
    assert.equal(text, 'page text');
    const upload = requests.find((r) => r.url === '/api/doc/upload');
    assert.match(upload.type, /^multipart\/form-data; boundary=/);
    const body = upload.body.toString('latin1');
    assert.match(body, /name="file"; filename="scan.pdf"/);
    assert.match(body, /name="json"/);
    assert.match(body, /"pageRangeStart":3/); assert.match(body, /"pageRangeEnd":3/); assert.match(body, /"pageList":\[3\]/);
    const result = JSON.parse(requests.find((r) => r.url === '/api/doc/result').body.toString());
    assert.deepEqual(result, { id: 'task-1', is_data: true, is_unread: false, format: 'text' });
    assert.ok(requests.some((r) => r.url === '/api/doc/clear/task-1'));
  } finally { pdf.close(); await api.close(); }
});

test('recognizePdfPage 取消时停止轮询并尽力清理', async () => {
  const controller = new AbortController(); let polls = 0; let cleared = false;
  const api = await fixture(async (req, res) => {
    await readBody(req); res.setHeader('content-type', 'application/json');
    if (req.url === '/api/doc/get_options') return res.end(JSON.stringify({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }));
    if (req.url === '/api/doc/upload') return res.end(JSON.stringify({ code: 100, data: 'cancel-task' }));
    if (req.url === '/api/doc/result') { polls++; controller.abort(); return res.end(JSON.stringify({ code: 100, is_done: false, state: 'running', data: [] })); }
    if (req.url === '/api/doc/clear/cancel-task') { cleared = true; return res.end(JSON.stringify({ code: 100 })); }
  });
  const pdf = tempPdf();
  try {
    await assert.rejects(createOcrClient({ endpoint: api.endpoint, pollMs: 1 }).recognizePdfPage(pdf.file, 1, { signal: controller.signal }), (e) => e.name === 'AbortError');
    assert.equal(polls, 1); assert.equal(typeof cleared, 'boolean');
  } finally { pdf.close(); await api.close(); }
});

test('clear 永不返回时 OCR 成功仍在独立短超时后返回文本', async () => {
  const pdf = tempPdf(); const fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/doc/get_options') return { ok: true, json: async () => ({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }) };
    if (pathname === '/api/doc/upload') return { ok: true, json: async () => ({ code: 100, data: 'task' }) };
    if (pathname === '/api/doc/result') return { ok: true, json: async () => ({ code: 100, is_done: true, state: 'success', data: 'bounded text' }) };
    return new Promise(() => {});
  };
  try {
    const started = Date.now();
    assert.equal(await createOcrClient({ endpoint: 'http://127.0.0.1:1224', fetch, clearTimeoutMs: 20 }).recognizePdfPage(pdf.file, 1), 'bounded text');
    assert.ok(Date.now() - started < 200);
  } finally { pdf.close(); }
});

test('clear 永不返回时 OCR 失败保留原 OCR_UNAVAILABLE', async () => {
  const pdf = tempPdf(); const fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/doc/get_options') return { ok: true, json: async () => ({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }) };
    if (pathname === '/api/doc/upload') return { ok: true, json: async () => ({ code: 100, data: 'task' }) };
    if (pathname === '/api/doc/result') return { ok: true, json: async () => ({ code: 100, is_done: true, state: 'failure', message: 'original OCR failure' }) };
    return new Promise(() => {});
  };
  try {
    await assert.rejects(createOcrClient({ endpoint: 'http://127.0.0.1:1224', fetch, clearTimeoutMs: 20 }).recognizePdfPage(pdf.file, 1),
      (error) => error.errorCode === 'OCR_UNAVAILABLE' && error.cause?.message === 'original OCR failure');
  } finally { pdf.close(); }
});

test('用户取消时 clear 忽略 signal 仍快速返回，不等待主 timeout', async () => {
  const pdf = tempPdf(); const controller = new AbortController(); let clearStarted = false; const fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/doc/get_options') return { ok: true, json: async () => ({ pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }) };
    if (pathname === '/api/doc/upload') return { ok: true, json: async () => ({ code: 100, data: 'task' }) };
    if (pathname === '/api/doc/result') { controller.abort(); return { ok: true, json: async () => ({ code: 100, is_done: false, state: 'running', data: [] }) }; }
    clearStarted = true; return new Promise(() => {});
  };
  try {
    const started = Date.now();
    await assert.rejects(createOcrClient({ endpoint: 'http://127.0.0.1:1224', fetch, timeoutMs: 10_000, clearTimeoutMs: 20 }).recognizePdfPage(pdf.file, 1, { signal: controller.signal }),
      (error) => error.name === 'AbortError');
    assert.equal(clearStarted, true); assert.ok(Date.now() - started < 1000);
  } finally { pdf.close(); }
});

test('文档 OCR 接口差异、失败与超时统一 OCR_UNAVAILABLE retryable', async () => {
  for (const response of [
    { options: {}, code: 100, data: 'unused' },
    { code: 101, data: 'upload failed' },
    { code: 100, data: 'task', result: { code: 100, is_done: true, state: 'failure', message: 'bad pdf' } },
    { code: 100, data: 'task', result: { code: 100, is_done: true, state: 'success', data: { unexpected: true } } },
  ]) {
    const api = await fixture(async (req, res) => { await readBody(req); res.setHeader('content-type', 'application/json');
      if (req.url === '/api/doc/get_options') return res.end(JSON.stringify(response.options || { pageRangeStart: {}, pageRangeEnd: {}, pageList: {} }));
      if (req.url === '/api/doc/upload') return res.end(JSON.stringify(response));
      if (req.url === '/api/doc/result') return res.end(JSON.stringify(response.result));
      return res.end(JSON.stringify({ code: 100 })); });
    const pdf = tempPdf();
    try { await assert.rejects(createOcrClient({ endpoint: api.endpoint, pollMs: 1, timeoutMs: 30 }).recognizePdfPage(pdf.file, 1), (e) => e.errorCode === 'OCR_UNAVAILABLE' && e.retryable); }
    finally { pdf.close(); await api.close(); }
  }
});
