// 联机验证：单词 / 短语 / 句式三类词条的词汇矩阵是否真的补齐
// 用法: node scripts/test-vocab-matrix-live.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { generateVocabMatrix, isMatrixComplete } = require('../services/vocabMatrixEnricher');

const apiKey = process.env.VOCAB_MATRIX_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY || '';

const CASES = [
  { text: 'leverage', kind: 'word' },
  { text: 'get this deal over the line', kind: 'phrase' },
  { text: 'We need to get this deal over the line before Q3.', kind: 'sentence' },
];

(async () => {
  if (!apiKey) {
    console.error('缺少 VOCAB_MATRIX_LLM_API_KEY / LISTEN_LLM_API_KEY');
    process.exit(1);
  }

  let failed = 0;
  for (const item of CASES) {
    const started = Date.now();
    try {
      const matrix = await generateVocabMatrix({ ...item, topic: '并购谈判', apiKey });
      const complete = isMatrixComplete(matrix, item.kind);
      if (!complete) failed++;
      console.log(`\n===== [${item.kind}] ${item.text} (${Date.now() - started}ms, 矩阵完整=${complete}) =====`);
      if (item.kind === 'sentence') {
        console.log('中文翻译  :', matrix.translation_zh);
        console.log('语法结构  :', matrix.grammar_structure);
        console.log('高管替换  :', matrix.executive_alternatives.join(' | '));
        console.log('场景 SOP  :', matrix.scenario_sop);
      } else {
        console.log('音标      :', matrix.phonetic);
        console.log('中文释义  :', matrix.meaning);
        console.log('同近义词  :', matrix.synonyms.join(' | '));
        console.log('搭配词组  :', matrix.collocations.join(' | '));
      }
      console.log('记忆节点源:', [...matrix.synonyms, ...matrix.collocations].slice(0, 6).join(' | '));
      console.log('记忆辅助  :', matrix.memory_hook);
      console.log('高管语态  :', matrix.executive_sop.register, '/', matrix.executive_sop.scenarios.join('、'));
    } catch (error) {
      failed++;
      console.error(`\n===== [${item.kind}] ${item.text} 失败: ${error.message}`);
    }
  }

  console.log(`\n联机验证结束：失败 ${failed} / ${CASES.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
