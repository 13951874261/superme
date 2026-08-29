import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCareerAwareProfileString } from './profileHelper';

test('buildCareerAwareProfileString 用新职业覆盖旧职业行', () => {
  const out = buildCareerAwareProfileString(
    '职业路径: 起点=旧; 当前=旧; 目标=旧; 能力匹配度=10%; 短板A',
    { history: 'H', current: 'C', target: 'T', progress: 23 },
  );
  assert.equal(out.includes('能力匹配度=23%'), true);
  assert.equal(out.includes('能力匹配度=10%'), false);
  assert.equal(out.includes('短板A'), true);
  assert.equal(out.includes('当前=旧'), false);
});
