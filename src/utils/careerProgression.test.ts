import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCareerPathLocal,
  CAREER_CHANGED_EVENT,
  CAREER_STORAGE_KEY,
  DEFAULT_CAREER_PATH,
  careerNodeLabel,
  formatCareerProfileLine,
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

test('formatCareerProfileLine 生成注入用短行', () => {
  const line = formatCareerProfileLine({
    history: '高级经理 (Senior Manager)',
    current: '总监 (Director)',
    target: '合伙人 (Partner / Managing Director)',
    progress: 23,
  });
  assert.equal(
    line,
    '职业路径: 起点=高级经理 (Senior Manager); 当前=总监 (Director); 目标=合伙人 (Partner / Managing Director); 能力匹配度=23%',
  );
});

test('applyCareerPathLocal 写入 localStorage 并返回 parse 结果', () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;

  const events: string[] = [];
  const fakeWindow = {
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  } as Window;

  const prevLocalStorage = globalThis.localStorage;
  const prevWindow = globalThis.window;
  Object.defineProperty(globalThis, 'localStorage', { value: fakeLocalStorage, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true });

  try {
    const result = applyCareerPathLocal({ history: 'A', current: 'B', target: 'C', progress: 40 });

    assert.equal(result.history, 'A');
    assert.equal(result.current, 'B');
    assert.equal(result.target, 'C');
    assert.equal(result.progress, 40);

    const saved = store.get(CAREER_STORAGE_KEY);
    assert.ok(saved);
    const parsed = JSON.parse(saved!) as { history: string; current: string; target: string; progress: number };
    assert.equal(parsed.history, 'A');
    assert.equal(parsed.current, 'B');
    assert.equal(parsed.target, 'C');
    assert.equal(parsed.progress, 40);

    assert.deepEqual(events, [CAREER_CHANGED_EVENT]);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: prevLocalStorage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: prevWindow,
      configurable: true,
    });
  }
});
