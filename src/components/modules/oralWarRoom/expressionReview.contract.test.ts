import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatSrc = fs.readFileSync(path.join(here, '..', 'OralWarRoomChat.tsx'), 'utf8');
const sessionSrc = fs.readFileSync(path.join(here, 'useOralWarRoomSession.ts'), 'utf8');
const oralSrc = fs.readFileSync(path.join(here, '..', 'OralWarRoom.tsx'), 'utf8');

test('日常复盘：Chat 仅在 showDailyExpressionDebrief 时露出结束并复盘', () => {
  assert.match(chatSrc, /showDailyExpressionDebrief/);
  assert.match(chatSrc, /结束并复盘/);
  assert.match(chatSrc, /表达复盘 · 疏漏与更好样例/);
  assert.match(chatSrc, /更好样例/);
});

test('日常复盘：Session 挂载结束处理器且谈判路径不强制触发', () => {
  assert.match(sessionSrc, /handleEndDailyExpressionReview/);
  assert.match(sessionSrc, /prepareDailyExpressionReviewRequest\(sandboxMode/);
  assert.match(sessionSrc, /showDailyExpressionDebrief: sandboxMode === 'daily'/);
  assert.match(sessionSrc, /requestExpressionReview/);
  assert.match(sessionSrc, /parse_miss/);
  assert.match(sessionSrc, /setIsInputLocked\(true\)/);
});

test('日常复盘：expressionReview 使用独立 intent', () => {
  const reviewSrc = fs.readFileSync(path.join(here, 'expressionReview.ts'), 'utf8');
  assert.match(reviewSrc, /EXPRESSION_REVIEW_INTENT/);
  assert.match(reviewSrc, /intent_judgement: EXPRESSION_REVIEW_INTENT/);
  assert.match(reviewSrc, /heuristicExpressionIssues/);
});

test('日常复盘：OralWarRoom 透传复盘 props', () => {
  assert.match(oralSrc, /onEndDailyExpressionReview=\{session\.handleEndDailyExpressionReview\}/);
  assert.match(oralSrc, /showDailyExpressionDebrief=\{session\.showDailyExpressionDebrief\}/);
});
