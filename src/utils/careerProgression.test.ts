import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREER_CHANGED_EVENT,
  CAREER_STORAGE_KEY,
  DEFAULT_CAREER_PATH,
  careerNodeLabel,
  parseCareerPath,
} from './careerProgression';

test('默认画像是总监 / 65%，不是顶栏写死的支行副行长 / 45%', () => {
  assert.equal(DEFAULT_CAREER_PATH.current.includes('总监'), true);
  assert.equal(DEFAULT_CAREER_PATH.progress, 65);
  assert.equal(CAREER_STORAGE_KEY, 'superme_career');
  assert.equal(CAREER_CHANGED_EVENT, 'superme-career-changed');
});

test('parseCareerPath 读同一份 history/current/target/progress', () => {
  const parsed = parseCareerPath({
    history: '科员',
    current: '支行副行长',
    target: '大区VP',
    progress: 45,
  });
  assert.equal(parsed.history, '科员');
  assert.equal(parsed.current, '支行副行长');
  assert.equal(parsed.target, '大区VP');
  assert.equal(parsed.progress, 45);
});

test('progress 越界被夹到 0–100', () => {
  assert.equal(parseCareerPath({ progress: 140 }).progress, 100);
  assert.equal(parseCareerPath({ progress: -3 }).progress, 0);
  assert.equal(parseCareerPath({}).progress, DEFAULT_CAREER_PATH.progress);
});

test('careerNodeLabel 取括号前短名', () => {
  assert.equal(careerNodeLabel('总监 (Director)'), '总监');
  assert.equal(careerNodeLabel('支行副行长'), '支行副行长');
});
