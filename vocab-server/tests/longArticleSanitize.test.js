const assert = require('assert');
const {
  stripThinkTags,
  prepareLongArticleBody,
  isUsableLongArticle,
} = require('../services/difyStreamMerge');

function testStripClosedThink() {
  const raw = '<think>internal plan</think>\nWelcome everyone to the board meeting.';
  const got = stripThinkTags(raw);
  assert.doesNotMatch(got, /<think/i);
  assert.match(got, /Welcome everyone/);
  console.log('OK strip closed think');
}

function testStripUnclosedThink() {
  const raw = '<think>The user wants me to write Segment 1 of a business meeting script';
  const got = stripThinkTags(raw);
  assert.strictEqual(got.trim(), '');
  assert.strictEqual(isUsableLongArticle(raw), false);
  console.log('OK strip unclosed think → unusable');
}

function testBoilerplateAndVocabFenceRemoved() {
  const raw = [
    '📝 沉浸式听力/阅读长篇材料 (生成完毕)',
    '',
    'Good morning, colleagues. Let us begin the quarterly review of our supply chain.',
    'We must align on the concession package before the counterparty arrives.',
    'Please prepare the risk memo, confirm the budget ceiling, and flag any compliance gaps.',
    'If we cannot close the pricing gap today, we will schedule a follow-up with legal and finance.',
    'Thank you for joining this session and for keeping the discussion focused on decisions.',
    '---VOCAB_JSON_START---',
    '{"words":[{"word":"concession"}],"phrases":["supply chain"]}',
  ].join('\n');
  const body = prepareLongArticleBody(raw);
  assert.doesNotMatch(body, /生成完毕/);
  assert.doesNotMatch(body, /VOCAB_JSON/);
  assert.match(body, /Good morning/);
  assert.strictEqual(isUsableLongArticle(raw), true);
  console.log('OK boilerplate + vocab fence stripped, body usable');
}

function testMetaThinkNotCached() {
  const raw = `<think>
The user wants me to write Segment 1 of a business meeting script - a welcome address by the manager about integrating new employees into company culture. Key parameters: - CEFR Level: B1 (Intermediate)... - Genre: meeting
</think>`;
  assert.strictEqual(isUsableLongArticle(raw), false);
  console.log('OK meta think is not a usable article');
}

testStripClosedThink();
testStripUnclosedThink();
testBoilerplateAndVocabFenceRemoved();
testMetaThinkNotCached();
console.log('✅ longArticleSanitize.test.js 通过');
