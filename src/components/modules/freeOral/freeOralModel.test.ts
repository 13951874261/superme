import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAssistantText, normalizeCollectCandidates, parseFocusCommand } from './freeOralModel';

test('parseFocusCommand：仅整行 /focus 命令生效', () => {
  assert.deepEqual(parseFocusCommand('/focus sustainable urban development'), {
    kind: 'focus',
    topic: 'sustainable urban development',
  });
  assert.deepEqual(parseFocusCommand('  /focus   AI governance  '), {
    kind: 'focus',
    topic: 'AI governance',
  });
  assert.deepEqual(parseFocusCommand("Let's focus on AI."), { kind: 'message' });
  assert.deepEqual(parseFocusCommand('hello /focus AI'), { kind: 'message' });
});

test('parseFocusCommand：拒绝空主题和超过 100 字符主题', () => {
  assert.equal(parseFocusCommand('/focus').kind, 'invalid');
  assert.equal(parseFocusCommand(`/focus ${'a'.repeat(101)}`).kind, 'invalid');
  assert.equal(parseFocusCommand('/focus AI\ngovernance').kind, 'invalid');
  assert.equal(parseFocusCommand('/focus AI\u0000governance').kind, 'invalid');
  assert.deepEqual(parseFocusCommand(`/focus ${'a'.repeat(100)}`), {
    kind: 'focus',
    topic: 'a'.repeat(100),
  });
});

test('normalizeCollectCandidates：合并 Dify 单词、短语、句式并去重', () => {
  assert.deepEqual(normalizeCollectCandidates({
    words: [
      { word: 'Sustainable', phonetic: '/səˈsteɪnəbl/', pos: 'adj.', zh_meaning: '可持续的' },
      { word: ' sustainable ', zh_meaning: '重复项' },
    ],
    phrases: [
      { phrase: 'balance A with B', meaning: '平衡 A 与 B' },
      { phrase: 'Balance A With B', meaning: '重复项' },
    ],
    sentences: ['It is essential that ...', '  '],
  }), [
    { id: 'word:sustainable', text: 'Sustainable', kind: 'word', meaning: '可持续的', phonetic: '/səˈsteɪnəbl/', pos: 'adj.' },
    { id: 'phrase:balance a with b', text: 'balance A with B', kind: 'phrase', meaning: '平衡 A 与 B' },
    { id: 'sentence:it is essential that ...', text: 'It is essential that ...', kind: 'sentence', meaning: '' },
  ]);
});

test('extractAssistantText：兼容 Dify 口语 Chatflow JSON 信封与纯文本', () => {
  assert.equal(extractAssistantText('{"dialogue":"That is a strong point.","current_speaker":"AI"}'), 'That is a strong point.');
  assert.equal(extractAssistantText('```json\n{"dialogue":"Let us explore it."}\n```'), 'Let us explore it.');
  assert.equal(extractAssistantText('{"answer":"Here is another angle."}'), 'Here is another angle.');
  assert.equal(extractAssistantText('{"message":"Could you give an example?"}'), 'Could you give an example?');
  assert.equal(extractAssistantText('Plain conversational reply.'), 'Plain conversational reply.');
});
