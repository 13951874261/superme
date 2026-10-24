/**
 * E6 / O1–O3 对照：非目标未扩张 + 可观测性契约。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('E6: 本轮隔离未引入 session 中间件 / clear-today 跨用户改写', () => {
  const server = fs.readFileSync(path.join(root, 'vocab-server/server.js'), 'utf8');
  // 非目标：不假装 session；不在本 diff 范围“修好”clear-today 跨用户
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8'),
    /sessionMiddleware|requireAuthSession/,
  );
  // parseVocabUserId 不再默认 lzhmy（隔离目标内）
  const block = server.slice(
    server.indexOf('function parseVocabUserId'),
    server.indexOf('function requireVocabUserId'),
  );
  assert.doesNotMatch(block, /return ['"]lzhmy['"]/);
});

test('O1: switchAccountSession 日志仅 from/to，不含夜话/画像正文键', () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8');
  const block = src.slice(
    src.indexOf('export async function switchAccountSession'),
    src.indexOf('export async function initializeUserSession'),
  );
  assert.match(block, /console\.info\('\[profileHelper\] switchAccountSession', \{ from: old, to: next \}\)/);
  assert.doesNotMatch(block, /profile_content|weeklyChatHistory|userContent/);
});

test('O3: user_memories 读路径无 SELECT *', () => {
  const server = fs.readFileSync(path.join(root, 'vocab-server/server.js'), 'utf8');
  assert.doesNotMatch(server, /SELECT \* FROM user_memories/);
  assert.match(
    server,
    /SELECT user_id, profile_content, error_ledger, memory_layers, updated_at FROM user_memories/,
  );
});
