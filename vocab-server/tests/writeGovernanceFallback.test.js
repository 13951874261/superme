// Write Governance Fallback unit tests
const assert = require('assert');

async function runTests() {
  const failures = [];
  let service;
  try {
    service = require('../services/writeGovernanceFallback');
  } catch (e) {
    console.error('FAIL: could not load service: ' + e.message);
    process.exitCode = 1;
    return;
  }

  const required = ['analyzeWriting', 'detectLanguage', 'getSystemPrompt', 'buildUserPrompt', 'normalizeResult', 'isMeaningfulResult'];
  for (const name of required) {
    if (typeof service[name] !== 'function') failures.push('Missing export: ' + name);
  }
  if (failures.length) {
    failures.forEach(f => console.error('  - ' + f));
    process.exitCode = 1;
    return;
  }

  // 1. detectLanguage
  assert.strictEqual(service.detectLanguage('这是一段中文公文写作'), 'zh');
  assert.strictEqual(service.detectLanguage('This is an English email'), 'en');
  assert.strictEqual(service.detectLanguage(''), 'unknown');
  assert.strictEqual(service.detectLanguage('12345'), 'unknown');
  assert.strictEqual(service.detectLanguage('Hello 你好 world'), 'zh'); // mixed -> zh because chinese >= latin*0.2
  console.log('PASS detectLanguage');

  // 2. getSystemPrompt
  const zhSys = service.getSystemPrompt('document_correction', 'zh');
  assert(zhSys.length > 50, 'too short');
  assert(zhSys.includes('批改'), 'missing 批改');
  assert(!/(\?{5,})/.test(zhSys), 'has corrupted chars');
  const enSys = service.getSystemPrompt('business_writing', 'en');
  assert(enSys.length > 50, 'EN too short');
  const valSys = service.getSystemPrompt('value_proposal', 'zh');
  assert(valSys.includes('价值提案') || valSys.includes('商业价值'), 'value prompt content');
  console.log('PASS getSystemPrompt');

  // 3. buildUserPrompt
  const up = service.buildUserPrompt('document_correction', '关于调整部门的通知草稿', '请检查格式');
  assert(up.includes('关于调整部门的通知草稿'));
  assert(up.includes('document_correction'));
  assert(up.includes('请检查格式'));
  console.log('PASS buildUserPrompt');

  // 4. normalizeResult
  const r1 = service.normalizeResult({ L1: 'a', L2: 'b', L3: 'c', optimized_version: 'opt' }, 'document_correction');
  assert.strictEqual(r1.L1, 'a'); assert.strictEqual(r1.optimized_version, 'opt');
  const r2 = service.normalizeResult({ tone_evaluation: 't', compressed_text: 'c', skill_point: 's' }, 'business_writing');
  assert.strictEqual(r2.tone_evaluation, 't');
  const r3 = service.normalizeResult({ admin_flaws: 'af', value_extraction: 've', business_proposal: 'bp' }, 'value_proposal');
  assert.strictEqual(r3.admin_flaws, 'af');
  const nested = service.normalizeResult({
    L1: { feedback: '语法层级正确' },
    L2: { analysis: '结构层级正确' },
    L3: { suggestion: '战略层级正确' },
    optimized_version: { text: '嵌套优化文本' },
  }, 'document_correction');
  assert.strictEqual(nested.L1, '语法层级正确');
  assert.strictEqual(nested.L2, '结构层级正确');
  assert.strictEqual(nested.L3, '战略层级正确');
  assert.strictEqual(nested.optimized_version, '嵌套优化文本');
  console.log('PASS normalizeResult');

  // 5. isMeaningfulResult
  assert.strictEqual(service.isMeaningfulResult({ L1: 'x' }, 'document_correction'), true);
  assert.strictEqual(service.isMeaningfulResult({ tone_evaluation: 'x' }, 'business_writing'), true);
  assert.strictEqual(service.isMeaningfulResult({ admin_flaws: 'x' }, 'value_proposal'), true);
  assert.strictEqual(service.isMeaningfulResult({}, 'document_correction'), false);
  assert.strictEqual(service.isMeaningfulResult(null, 'document_correction'), false);
  console.log('PASS isMeaningfulResult');

  // 6. analyzeWriting with mock https
  const https = require('https');
  const origRequest = https.request;
  let capturedBody = null;

  https.request = function(url, options, callback) {
    const mockResponse = {
      statusCode: 200,
      on: function(event, handler) {
        if (event === 'data') {
          const fakeBody = JSON.stringify({
            choices: [{ message: { content: '{"L1":"语法无误","L2":"结构合理","L3":"站位提升","optimized_version":"优化版"}' } }]
          });
          handler(Buffer.from(fakeBody));
        }
        if (event === 'end') {
          handler();
        }
        return mockResponse;
      },
    };

    const mockRequest = {
      on: function() { return mockRequest; },
      setTimeout: function() {},
      write: function(body) { capturedBody = body; },
      end: function() {
        callback(mockResponse);
      },
    };
    return mockRequest;
  };

  try {
    const result = await service.analyzeWriting(
      { taskType: 'document_correction', originalText: '关于调整部门的通知', additionalParams: '' },
      'test-key'
    );
    assert.strictEqual(result.L1, '语法无误', 'L1 mismatch: ' + result.L1);
    assert.strictEqual(result.L2, '结构合理', 'L2 mismatch');
    assert.strictEqual(result.L3, '站位提升', 'L3 mismatch');
    assert.strictEqual(result.optimized_version, '优化版', 'optimized_version mismatch');
    assert(capturedBody !== null, 'LLM not called');
    const bodyObj = JSON.parse(capturedBody);
    assert(bodyObj.messages[0].content.includes('批改'), 'system prompt corrupted');
    console.log('PASS analyzeWriting');
  } catch (e) {
    failures.push('analyzeWriting threw: ' + e.message);
  } finally {
    https.request = origRequest;
  }

  // 7. analyzeWriting missing API key -> throws
  try {
    await service.analyzeWriting({ taskType: 'document_correction', originalText: '测试', additionalParams: '' }, '');
    failures.push('Should throw on missing API key');
  } catch (e) {
    assert(e.message.includes('missing'), 'Unexpected error: ' + e.message);
  }

  // 8. analyzeWriting empty text -> throws
  try {
    await service.analyzeWriting({ taskType: 'document_correction', originalText: '', additionalParams: '' }, 'key');
    failures.push('Should throw on empty text');
  } catch (e) {
    assert(e.message.includes('required') || e.message.includes('originalText'), 'Unexpected: ' + e.message);
  }
  console.log('PASS analyzeWriting error paths');

  // 9. analyzeWriting LLM failure -> throws
  https.request = function(url, options, callback) {
    const mockResponse = {
      statusCode: 500,
      on: function(event, handler) {
        if (event === 'data') handler(Buffer.from('server error'));
        if (event === 'end') handler();
        return mockResponse;
      },
    };
    const mockRequest = {
      on: function() { return mockRequest; },
      setTimeout: function() {},
      write: function() {},
      end: function() { callback(mockResponse); },
    };
    return mockRequest;
  };
  try {
    await service.analyzeWriting(
      { taskType: 'document_correction', originalText: '关于调整部门的通知', additionalParams: '' },
      'test-key'
    );
    failures.push('Should throw on LLM 500');
  } catch (e) {
    assert(e.message.includes('500') || e.message.includes('LLM'), 'Unexpected: ' + e.message);
  } finally {
    https.request = origRequest;
  }
  console.log('PASS analyzeWriting LLM failure');

  if (failures.length === 0) {
    console.log('OK writeGovernanceFallback: all tests passed');
  } else {
    console.error('FAIL:');
    failures.forEach(f => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

runTests().catch(e => { console.error('Unhandled:', e); process.exitCode = 1; });