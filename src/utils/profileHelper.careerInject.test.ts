import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCareerAwareProfileString, buildStaticDifyProfilePreview } from './profileHelper';

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

test('buildStaticDifyProfilePreview 至少包含职业行与短板', () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fakeLocalStorage, configurable: true });
  try {
    const out = buildStaticDifyProfilePreview('短板B', {
      history: 'H',
      current: 'C',
      target: 'T',
      progress: 33,
    });
    assert.equal(out.includes('能力匹配度=33%'), true);
    assert.equal(out.includes('短板B'), true);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});
