/**
 * GT-TAC tacticsIngest 单测
 * 运行：node --test vocab-server/tests/tacticsIngest.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TACTICS_INGEST_MAX_MB,
  TACTICS_INGEST_MAX_MINUTES,
  TACTICS_INGEST_MAX_BYTES,
  assertWithinLimits,
  isVideoFileName,
  isDocFileName,
  parseTacticsLlmJson,
} = require('../services/tacticsIngest');

describe('limits', () => {
  it('常量', () => {
    assert.equal(TACTICS_INGEST_MAX_MB, 200);
    assert.equal(TACTICS_INGEST_MAX_MINUTES, 30);
    assert.equal(TACTICS_INGEST_MAX_BYTES, 200 * 1024 * 1024);
  });

  it('体积超限失败', () => {
    const r = assertWithinLimits({ sizeBytes: TACTICS_INGEST_MAX_BYTES + 1 });
    assert.equal(r.ok, false);
    assert.match(r.error, /200MB/);
  });

  it('时长超限失败', () => {
    const r = assertWithinLimits({ sizeBytes: 1000, durationSec: 30 * 60 + 1 });
    assert.equal(r.ok, false);
    assert.match(r.error, /30/);
  });

  it('合规通过', () => {
    const r = assertWithinLimits({ sizeBytes: 1024, durationSec: 60 });
    assert.equal(r.ok, true);
  });
});

describe('file kind', () => {
  it('识别视频与文档', () => {
    assert.equal(isVideoFileName('a.mp4'), true);
    assert.equal(isVideoFileName('a.PDF'), false);
    assert.equal(isDocFileName('book.pdf'), true);
    assert.equal(isDocFileName('clip.mov'), false);
  });
});

describe('parseTacticsLlmJson', () => {
  it('解析数组', () => {
    const list = parseTacticsLlmJson('[{"name":"捧杀","category":"downward","description":"先捧后打"}]');
    assert.equal(list.length, 1);
    assert.equal(list[0].name, '捧杀');
  });

  it('解析代码块包裹', () => {
    const list = parseTacticsLlmJson('```json\n[{"name":"借刀","category":"upward","description":"借力"}]\n```');
    assert.equal(list[0].category, 'upward');
  });

  it('无效返回空', () => {
    assert.deepEqual(parseTacticsLlmJson('nonsense'), []);
  });
});
