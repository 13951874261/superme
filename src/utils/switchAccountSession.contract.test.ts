/**
 * G005 契约：switchAccountSession 存在且设置改号走它；App 用 userId key。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('switchAccountSession：先 flush，静默 setId，load 后再 dispatch', () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8');
  const block = src.slice(src.indexOf('export async function switchAccountSession'), src.indexOf('export async function initializeUserSession'));
  assert.match(block, /flushLearningUi/);
  assert.match(block, /setAppUserId\(next, \{ dispatch: false \}\)/);
  assert.match(block, /loadLearningUiFromServer/);
  assert.match(block, /clearSessionKeysOnSwitch/);
  assert.match(block, /dispatchUserIdChanged\(\)/);
  const flushIdx = block.indexOf('flushLearningUi');
  const setIdx = block.indexOf('setAppUserId(next, { dispatch: false })');
  const loadIdx = block.indexOf('loadLearningUiFromServer');
  const dispatchIdx = block.indexOf('dispatchUserIdChanged()');
  assert.ok(flushIdx >= 0 && setIdx > flushIdx, 'flush must precede setAppUserId');
  assert.ok(loadIdx > setIdx, 'load after silent setId');
  assert.ok(dispatchIdx > loadIdx, 'dispatch after load so remount sees hydrated bucket');
});

test('GlobalSettingsPanel 改号走 switchAccountSession', () => {
  const src = fs.readFileSync(path.join(root, 'src/components/GlobalSettingsPanel.tsx'), 'utf8');
  assert.match(src, /switchAccountSession/);
  assert.doesNotMatch(src, /setAppUserId\(next\)/);
});

test('App 工作台 key 含 userId', () => {
  const src = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(src, /key=\{`app-shell-\$\{userId\}`\}/);
  assert.match(src, /global-user-id-changed/);
});
