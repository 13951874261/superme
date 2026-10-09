/**
 * Unit smoke for getPregeneratedCombo (in-memory mock db).
 * Run: node vocab-server/scripts/test-getPregeneratedCombo.js
 */
const path = require('path');
const assert = require('assert');
const svc = require('../services/dailyListenPreGenerateService');

function mockDb({ article, audio }) {
  return {
    prepare(sql) {
      const isArticle = /daily_listen_articles/.test(sql);
      return {
        get(...args) {
          return isArticle ? article : audio;
        },
      };
    },
  };
}

const baseRaw = {
  userId: 'u1',
  theme: 'business',
  genre: 'news',
  cefrLevel: 'B1',
  duration: 15,
  date: '2026-07-24',
};

function run(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

run('uncached_duration', () => {
  const r = svc.getPregeneratedCombo(mockDb({}), { ...baseRaw, duration: 10 });
  assert.strictEqual(r.status, 'uncached_duration');
  assert.strictEqual(r.canBackfill, false);
  assert.strictEqual(r.packDate, '2026-07-24');
});

run('missing when no rows', () => {
  const r = svc.getPregeneratedCombo(mockDb({ article: null, audio: null }), baseRaw);
  assert.strictEqual(r.status, 'missing');
  assert.strictEqual(r.canBackfill, true);
  assert.strictEqual(r.article, null);
  assert.strictEqual(r.audio, null);
});

run('ready when article+audio ready', () => {
  const articleFile = path.join(svc.ARTICLE_ROOT, 'u1', '2026-07-24.md');
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: {
        status: 'ready',
        body_text: 'Hello body',
        vocab_json: '[{"w":"a"}]',
        phrases_json: '[{"p":"b"}]',
        file_path: articleFile,
      },
      audio: {
        status: 'ready',
        script_text: 'script here',
        audio_path: null,
        audio_url: '/api/daily_listen_audio/x.mp3',
      },
    }),
    baseRaw,
  );
  assert.strictEqual(r.status, 'ready');
  assert.strictEqual(r.canBackfill, false);
  assert.strictEqual(r.articleStatus, 'ready');
  assert.strictEqual(r.audioStatus, 'ready');
  assert.strictEqual(r.article.body, 'Hello body');
  assert.deepStrictEqual(r.article.vocab, [{ w: 'a' }]);
  assert.deepStrictEqual(r.article.phrases, [{ p: 'b' }]);
  assert.ok(r.article.fileUrl.startsWith('/api/daily_long_articles/'));
  assert.strictEqual(r.audio.script, 'script here');
  assert.strictEqual(r.audio.audioUrl, '/api/daily_listen_audio/x.mp3');
});

run('partial when only article ready', () => {
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: { status: 'ready', body_text: 'only article', vocab_json: null, phrases_json: null, file_path: null },
      audio: null,
    }),
    baseRaw,
  );
  assert.strictEqual(r.status, 'partial');
  assert.strictEqual(r.canBackfill, true);
  assert.ok(r.article);
  assert.strictEqual(r.audio, null);
});

run('generating takes precedence over failed when neither ready', () => {
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: { status: 'generating' },
      audio: { status: 'failed' },
    }),
    baseRaw,
  );
  assert.strictEqual(r.status, 'generating');
  assert.strictEqual(r.canBackfill, false);
});

run('generating takes precedence over partial while audio is still synthesizing', () => {
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: { status: 'ready', body_text: 'only article', vocab_json: null, phrases_json: null, file_path: null },
      audio: { status: 'generating' },
    }),
    baseRaw,
  );
  assert.strictEqual(r.status, 'generating');
  assert.strictEqual(r.canBackfill, false);
});

run('failed when either failed and not partial/ready', () => {
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: { status: 'failed' },
      audio: { status: 'missing' },
    }),
    baseRaw,
  );
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.canBackfill, true);
});

run('DB ready but no body/file => article missing => overall missing', () => {
  const r = svc.getPregeneratedCombo(
    mockDb({
      article: { status: 'ready', body_text: null, file_path: '/nonexistent/path.md' },
      audio: { status: 'ready', audio_path: '/nonexistent/a.mp3', audio_url: null },
    }),
    baseRaw,
  );
  assert.strictEqual(r.articleStatus, 'missing');
  assert.strictEqual(r.audioStatus, 'missing');
  assert.strictEqual(r.status, 'missing');
  assert.strictEqual(r.canBackfill, true);
});

run('resolveArticleStatus / resolveAudioStatus helpers', () => {
  assert.strictEqual(svc.resolveArticleStatus(null), 'missing');
  assert.strictEqual(svc.resolveArticleStatus({ status: 'ready', body_text: 'x' }), 'ready');
  assert.strictEqual(svc.resolveAudioStatus({ status: 'ready', audio_url: 'http://x' }), 'ready');
  assert.strictEqual(svc.fileOk(null), null); // falsy path
});

if (!process.exitCode) {
  console.log('\nAll getPregeneratedCombo checks passed.');
}
