/**
 * Wave 4 听上传→草稿（纯函数，不打 HTTPS / 不依赖 better-sqlite3）。
 * 运行：node vocab-server/tests/knowledgeDraftExtract.test.js
 */
const assert = require('assert');
const {
  guessSourceType,
  parseExtractedDraft,
  buildFallbackDraft,
  createListenUploadDraft
} = require('../services/knowledgeDraftExtract');

assert.equal(guessSourceType('case.pdf', 'application/pdf'), 'upload_book');
assert.equal(guessSourceType('talk.mp3', 'audio/mpeg'), 'upload_video');

assert.equal(parseExtractedDraft(null), null);
assert.equal(parseExtractedDraft({ title: '', summary: 'x' }), null);
const parsed = parseExtractedDraft({
  title: '信息不对称',
  category: 'nope',
  summary: '一方掌握更多信息时会影响报价。',
  tags: ['博弈', 1, '听']
});
assert.equal(parsed.title, '信息不对称');
assert.equal(parsed.category, 'game_theory');
assert.deepEqual(parsed.tags, ['博弈', '听']);

const fallback = buildFallbackDraft({ fileName: '信息不对称.pdf', text: '' });
assert.equal(fallback.title, '信息不对称');
assert.ok(fallback.summary.includes('待提炼'));
assert.equal(fallback.category, 'game_theory');

const inserts = [];
const fakeDb = {
  prepare(sql) {
    const text = String(sql);
    if (text.includes('INSERT INTO knowledge_vault')) {
      return {
        run(...args) {
          inserts.push(args);
        }
      };
    }
    if (text.includes('SELECT * FROM knowledge_vault WHERE id = ?')) {
      return {
                    get(id) {
          const row = inserts.find((item) => item[0] === id) || inserts[inserts.length - 1];
          return {
            id,
            user_id: row[1],
            type: row[2],
            word: row[3],
            meaning: row[4],
            example: row[5],
            title: row[6],
            category: row[7],
            summary: row[8],
            content: row[9],
            source: row[10],
            added_at: row[11],
            tags: row[12],
            extra_json: row[13]
          };
        }
      };
    }
    throw new Error('unexpected sql: ' + sql);
  }
};

async function run() {
  const created = await createListenUploadDraft(fakeDb, {
    userId: 'u1',
    fileName: '信息不对称.pdf',
    mimeType: 'application/pdf',
    base64Content: Buffer.from('x').toString('base64')
  }, {
    extractTextFromBuffer: async () => '甲方掌握定价权，乙方只能接受报价。这是典型的信息不对称。'.repeat(3),
    extractWithLLM: async () => ({
      title: '信息不对称',
      category: 'game_theory',
      summary: '一方掌握更多信息时会影响报价。',
      tags: ['博弈']
    })
  });
  assert.equal(created.extracted, true);
  assert.equal(created.row.syncStatus, 'draft');
  assert.deepEqual(created.row.moduleTargets, []);
  assert.equal(created.row.sourceType, 'upload_book');
  assert.equal(created.row.title, '信息不对称');
  assert.equal(created.row.sourceRef.fileName, '信息不对称.pdf');

  const fallbackCreated = await createListenUploadDraft(fakeDb, {
    userId: 'u1',
    sourceUrl: 'https://example.com/article'
  }, {
    fetchUrlContent: async () => '',
    extractWithLLM: async () => {
      throw new Error('should not call LLM on short text');
    }
  });
  assert.equal(fallbackCreated.extracted, false);
  assert.equal(fallbackCreated.row.syncStatus, 'draft');
  assert.equal(fallbackCreated.row.sourceType, 'upload_book');
  assert.equal(fallbackCreated.row.sourceRef.sourceUrl, 'https://example.com/article');
  assert.ok(fallbackCreated.row.title.length > 0);

  console.log('knowledgeDraftExtract.test.js passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
