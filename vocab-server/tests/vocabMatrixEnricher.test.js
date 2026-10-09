const assert = require('assert');
const {
  classifyKind,
  buildSystemPrompt,
  normalizeMatrix,
  isMatrixComplete,
  generateVocabMatrix,
  seedMatrixFromDictPayload,
  buildFallbackMemoryAids,
  runMemoryAidWorkflow,
} = require('../services/vocabMatrixEnricher');

// 1. 三类词条口径判定
assert.strictEqual(classifyKind({ text: 'leverage' }), 'word');
assert.strictEqual(classifyKind({ text: 'get this deal over the line', isPhrase: true }), 'phrase');
assert.strictEqual(classifyKind({ text: 'We need to get this deal over the line before Q3.', isSentence: true }), 'sentence');
assert.strictEqual(classifyKind({ text: 'We need to get this deal over the line before Q3.' }), 'sentence', '长句未打标记也应判为句式');

// 2. 单词/短语矩阵字段完整落位
const wordMatrix = normalizeMatrix({
  phonetic: '/ˈlevərɪdʒ/',
  part_of_speech: 'n./v.',
  meaning_zh: '杠杆；善用资源放大结果',
  definition_en: 'to use existing resources to maximize business outcomes',
  synonyms: ['capitalize on', 'harness', 'exploit', 'capitalize on'],
  antonyms: ['waste'],
  collocations: ['leverage our network', 'leverage existing assets'],
  business_note: '避免暗示利用他人',
  memory_hook: '杠杆撬动订单',
  register: 'High Power / 决策级',
  scenarios: ['QBR 汇报', '高层谈判'],
  sop_tip: '搭配量化收益使用',
  examples: [{ en: 'We leverage our network.', zh: '我们善用现有人脉。' }],
}, { text: 'leverage', kind: 'word' });

assert.strictEqual(wordMatrix.phonetic, '/ˈlevərɪdʒ/');
assert.strictEqual(wordMatrix.meaning, '杠杆；善用资源放大结果');
assert.strictEqual(wordMatrix.translation_main, wordMatrix.meaning);
assert.deepStrictEqual(wordMatrix.synonyms, ['capitalize on', 'harness', 'exploit'], '同近义词需去重');
assert.strictEqual(wordMatrix.collocations.length, 2);
assert.strictEqual(wordMatrix.executive_sop.register, 'High Power / 决策级');
assert.deepStrictEqual(wordMatrix.executive_sop.scenarios, ['QBR 汇报', '高层谈判']);
assert.strictEqual(wordMatrix.executive_sop.tip, '搭配量化收益使用');
assert.strictEqual(wordMatrix.examples[0], 'We leverage our network. 我们善用现有人脉。');
assert.ok(wordMatrix.matrix_generated_at > 0);
assert.ok(isMatrixComplete(wordMatrix, 'word'), '单词矩阵应判定为已补齐');

// 3. 句式矩阵：翻译 / 语法结构 / 高管替换 / 场景 SOP / 记忆节点
const sentenceMatrix = normalizeMatrix({
  translation_zh: '我们需要在三季度前把这笔交易拿下来。',
  grammar_structure: 'We need to + V 原形（必要性）+ get sth over the line（完成成交）+ before Q3（时限）',
  executive_alternatives: ['We should close this transaction before Q3.', 'Let us lock this deal in ahead of Q3.'],
  key_phrases: ['get sth over the line', 'before Q3'],
  scenario_sop: '适用于周会催进度与对上承诺时限，不宜直接对客户施压',
  register: 'High Power / 决策级',
  scenarios: ['周会催进度', '对上承诺'],
  memory_hook: '把交易推过终点线',
  examples: ['Let us get the contract over the line this week. 本周把合同签下来。'],
}, { text: 'We need to get this deal over the line before Q3.', kind: 'sentence' });

assert.strictEqual(sentenceMatrix.matrix_kind, 'sentence');
assert.strictEqual(sentenceMatrix.partOfSpeech, 'sentence');
assert.strictEqual(sentenceMatrix.meaning, '我们需要在三季度前把这笔交易拿下来。');
assert.strictEqual(sentenceMatrix.translation_zh, sentenceMatrix.meaning);
assert.ok(sentenceMatrix.grammar_structure.includes('We need to'));
assert.strictEqual(sentenceMatrix.executive_alternatives.length, 2);
assert.strictEqual(sentenceMatrix.scenario_sop, '适用于周会催进度与对上承诺时限，不宜直接对客户施压');
// 句式复用单词的圆形记忆矩阵节点：替换表达→synonyms，关键搭配→collocations
assert.deepStrictEqual(sentenceMatrix.synonyms, sentenceMatrix.executive_alternatives);
assert.deepStrictEqual(sentenceMatrix.collocations, sentenceMatrix.key_phrases);
assert.ok(isMatrixComplete(sentenceMatrix, 'sentence'), '句式矩阵应判定为已补齐');

// 4. 占位符必须被清洗，且清洗后不得误判为已补齐
const placeholderMatrix = normalizeMatrix({
  phonetic: '待补充',
  meaning_zh: '目标词的中文简明翻译',
  synonyms: ['待补充', 'N/A'],
  collocations: [],
  register: '暂无',
}, { text: 'synergy', kind: 'word' });
assert.strictEqual(placeholderMatrix.phonetic, '');
assert.strictEqual(placeholderMatrix.meaning, '');
assert.deepStrictEqual(placeholderMatrix.synonyms, []);
assert.strictEqual(placeholderMatrix.executive_sop.register, 'Neutral / 协作级');
assert.ok(!isMatrixComplete(placeholderMatrix, 'word'), '占位符内容不得被视为补齐完成');

// 5. 句式与单词使用不同提示词口径，但都强制 JSON
assert.ok(buildSystemPrompt('sentence').includes('grammar_structure'));
assert.ok(buildSystemPrompt('sentence').includes('scenario_sop'));
assert.ok(buildSystemPrompt('word').includes('collocations'));
assert.ok(buildSystemPrompt('word').includes('只返回合法 JSON'));

// 6. 生成入口：缺 key 直接失败，不静默降级
(async () => {
  await assert.rejects(
    () => generateVocabMatrix({ text: 'leverage', kind: 'word', apiKey: '' }),
    /VOCAB_MATRIX_LLM_API_KEY/,
  );
  await assert.rejects(
    () => generateVocabMatrix({ text: '', kind: 'word', apiKey: 'k' }),
    /text is required/,
  );

  const calls = [];
  const generated = await generateVocabMatrix({
    text: 'leverage',
    kind: 'word',
    topic: '并购谈判',
    apiKey: 'test-key',
    callImpl: async (systemPrompt, userPrompt, apiKey) => {
      calls.push({ systemPrompt, userPrompt, apiKey });
      return { meaning_zh: '杠杆', phonetic: '/ˈlevərɪdʒ/', synonyms: ['harness'], register: 'High Power / 决策级' };
    },
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].apiKey, 'test-key');
  assert.ok(calls[0].userPrompt.includes('并购谈判'));
  assert.ok(isMatrixComplete(generated, 'word'));

  // 7. 记忆辅助兜底：工作流不可用时仍产出记忆钩子
  const fallback = buildFallbackMemoryAids(wordMatrix, 'leverage');
  assert.strictEqual(fallback.root_memory, '杠杆撬动订单');
  assert.ok(fallback.association_memory.includes('capitalize on'));
  assert.ok(fallback.image_prompt.includes('leverage'), '兜底须带可用 image_prompt');

  // 8. 记忆辅助工作流解析：兼容 markdown 围栏包裹的 JSON
  const aids = await runMemoryAidWorkflow({
    word: 'leverage',
    apiKey: 'memory-key',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: { outputs: { result: '```json\n{"root_memory":"lev = 抬升","association_memory":"撬棍","mnemonic_phrase":"leverage the lever","image_prompt":"a lever"}\n```' } },
      }),
    }),
  });
  assert.strictEqual(aids.root_memory, 'lev = 抬升');
  assert.strictEqual(aids.mnemonic_phrase, 'leverage the lever');

  await assert.rejects(() => runMemoryAidWorkflow({ word: 'x', apiKey: '' }), /DIFY_MEMORY_AID_API_KEY/);

  let sentInputs = null;
  await runMemoryAidWorkflow({
    word: 'mud',
    phonetic: '',
    pos: '',
    definition: '',
    examples: '',
    userProfile: '',
    apiKey: 'memory-key',
    fetchImpl: async (_url, opts) => {
      sentInputs = JSON.parse(opts.body).inputs;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { outputs: { result: 'Missing input. Provide: word, phonetic, pos, definition, examples, user_current_profile.' } },
        }),
      };
    },
  }).then(
    () => { throw new Error('Missing input 应视为无 JSON'); },
    (err) => { assert.match(String(err.message), /no JSON/i); },
  );
  assert.equal(sentInputs.word, 'mud');
  assert.notEqual(sentInputs.phonetic, '');
  assert.notEqual(sentInputs.user_current_profile, '');

  // 9. 词典 payload 可种子化矩阵（month 场景：LLM 失败时仍可补齐）
  const monthDict = {
    direction_resolved: 'en_to_zh',
    phonetic: '/mʌnθ/',
    pos: 'n.',
    translation_main: '月；月份',
    etymology: '源自古英语 mōnaþ',
    synonyms: ['moon'],
    antonyms: [],
    collocations: ['this month', 'next month', 'once a month'],
    example_sentences: [
      { en: 'My birthday is in May.', zh: '我的生日在五月。' },
    ],
  };
  const seeded = seedMatrixFromDictPayload(monthDict, { text: 'month', kind: 'word' });
  assert.ok(seeded, 'month 词典 payload 应能种子化矩阵');
  assert.strictEqual(seeded.meaning, '月；月份');
  assert.strictEqual(seeded.phonetic, '/mʌnθ/');
  assert.ok(seeded.matrix_seeded_from_dict);
  assert.ok(isMatrixComplete(seeded, 'word'), '种子化后应判定矩阵已补齐');
  assert.strictEqual(
    seedMatrixFromDictPayload({ translation_main: '只有释义' }, { text: 'x', kind: 'word' }),
    null,
    '缺音标/节点时不得伪造成功',
  );

  console.log('vocab matrix enricher tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
