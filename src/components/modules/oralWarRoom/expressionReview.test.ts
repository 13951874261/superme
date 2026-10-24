import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExpressionReviewPrompt,
  collectUserUtterances,
  normalizeExpressionReview,
  parseExpressionReviewAnswer,
  prepareDailyExpressionReviewRequest,
  type ExpressionIssue,
} from './expressionReview';

test('normalize：can talking 夹具至少产出 1 条 grammar + betterExample', () => {
  const raw = {
    issues: [
      {
        snippet: 'can talking',
        type: 'grammar',
        problem: '情态动词后应接原形，不能用 talking',
        betterExample: 'we can talk about the contract tomorrow',
      },
      {
        original: 'I think maybe we can talking about the contract tomorrow?',
        kind: 'idiomatic',
        explanation: 'maybe + I think 叠用偏啰嗦',
        suggested: 'Maybe we can talk about the contract tomorrow?',
      },
    ],
  };

  const review = normalizeExpressionReview(raw);
  assert.ok(review.issues.length >= 1);

  const grammar = review.issues.filter((i: ExpressionIssue) => i.type === 'grammar');
  assert.ok(grammar.length >= 1);
  assert.match(grammar[0].snippet, /can talking/i);
  assert.ok(grammar[0].betterExample.length > 0);
  assert.ok(grammar[0].problem.length > 0);

  const idiomatic = review.issues.filter((i: ExpressionIssue) => i.type === 'idiomatic');
  assert.equal(idiomatic.length, 1);
  assert.equal(idiomatic[0].type, 'idiomatic');
  assert.ok(idiomatic[0].betterExample.includes('talk'));
});

test('normalize：非法/空载荷返回空 issues，不抛错', () => {
  assert.deepEqual(normalizeExpressionReview(null).issues, []);
  assert.deepEqual(normalizeExpressionReview(undefined).issues, []);
  assert.deepEqual(normalizeExpressionReview('oops').issues, []);
  assert.deepEqual(normalizeExpressionReview({ issues: [{ type: 'grammar' }] }).issues, []);
});

test('normalize：兼容 type 别名 grammar/idiomatic', () => {
  const review = normalizeExpressionReview({
    issues: [
      { snippet: 'a', type: '语法', problem: 'p', betterExample: 'b' },
      { snippet: 'c', type: '地道', problem: 'p2', betterExample: 'd' },
    ],
  });
  assert.equal(review.issues[0].type, 'grammar');
  assert.equal(review.issues[1].type, 'idiomatic');
});

test('collectUserUtterances：只收集 user 角色非空文本', () => {
  const texts = collectUserUtterances([
    { role: 'ai', content: 'Hey' },
    { role: 'user', content: '  can talking  ' },
    { role: 'user', content: '' },
    { role: 'user', content: 'hello' },
  ]);
  assert.deepEqual(texts, ['can talking', 'hello']);
});

test('prepareDailyExpressionReviewRequest：谈判模式返回 null（无副作用载荷）', () => {
  const req = prepareDailyExpressionReviewRequest('negotiation', [
    { role: 'user', content: 'can talking' },
  ]);
  assert.equal(req, null);
});

test('prepareDailyExpressionReviewRequest：日常模式收集用户发言', () => {
  const req = prepareDailyExpressionReviewRequest('daily', [
    { role: 'ai', content: 'Hi' },
    { role: 'user', content: 'I think maybe we can talking about the contract tomorrow?' },
  ]);
  assert.ok(req);
  assert.deepEqual(req!.utterances, [
    'I think maybe we can talking about the contract tomorrow?',
  ]);
});

test('buildExpressionReviewPrompt：包含用户发言与 JSON 约束', () => {
  const prompt = buildExpressionReviewPrompt(['can talking']);
  assert.match(prompt, /can talking/);
  assert.match(prompt, /grammar\|idiomatic/);
  assert.match(prompt, /issues/);
  assert.match(prompt, /flaw_point/);
  assert.match(prompt, /expression_review/);
});

test('parseExpressionReviewAnswer：从含杂讯文本中解析 can talking 语法条', () => {
  const review = parseExpressionReviewAnswer(`Here you go:
{"issues":[{"snippet":"can talking","type":"grammar","problem":"modal + -ing","betterExample":"we can talk about the contract tomorrow"}]}
`);
  assert.equal(review.issues.length, 1);
  assert.equal(review.issues[0].type, 'grammar');
  assert.match(review.issues[0].snippet, /can talking/i);
});

test('analyzeExpressionReviewAnswer：沙盘信封视为 parse_miss', async () => {
  const { analyzeExpressionReviewAnswer } = await import('./expressionReview');
  const result = analyzeExpressionReviewAnswer(JSON.stringify({
    dialogue: 'Sure.',
    flaw_point: '',
    current_speaker: 'partner',
  }));
  assert.equal(result.status, 'parse_miss');
});

test('heuristicExpressionIssues：覆盖 can talking 验收夹具', async () => {
  const { heuristicExpressionIssues } = await import('./expressionReview');
  const issues = heuristicExpressionIssues([
    'I think maybe we can talking about the contract tomorrow?',
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'grammar');
  assert.match(issues[0].betterExample, /can talk/i);
});
