const assert = require('assert');
const { heuristicExtractVocab, classifyFallbackResult } = require('../services/vocabExtractFallback');

const englishSample = `
Today we are going to discuss negotiation strategies in business meetings.
You should always prepare your opening statement carefully before the meeting starts.
The counterpart may signal weakness when they accept late delivery without pushback.
`;

const chineseSample = `
今天我们讨论商务谈判中的沟通策略。你需要在会议开始前认真准备开场白。
对方如果在没有争取的情况下接受延迟交付，往往是在释放软弱信号。
`;

const en = heuristicExtractVocab(englishSample);
assert.ok(en.words.length > 0, 'english heuristic should extract words');
assert.ok(en.phrases.length > 0, 'english heuristic should extract phrases');
assert.ok(en.sentences.length > 0, 'english heuristic should extract sentences');

const zh = heuristicExtractVocab(chineseSample);
assert.ok(zh.words.length > 0, 'chinese heuristic should extract words');
assert.ok(zh.sentences.length > 0, 'chinese heuristic should extract sentences');

const classified = classifyFallbackResult({
  vocab: [{ word: 'negotiation' }],
  phrases: [{ phrase: 'opening statement' }],
  sentences: [{ sentence: 'Prepare your opening statement carefully.' }],
});
assert.strictEqual(classified.words[0], 'negotiation');
assert.strictEqual(classified.phrases[0], 'opening statement');
assert.ok(classified.sentences[0].includes('opening statement'));

console.log('vocabExtractFallback tests passed');
