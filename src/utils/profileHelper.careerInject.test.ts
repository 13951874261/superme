import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCareerAwareProfileString,
  buildStaticDifyProfilePreview,
  getInjectedUserCurrentProfile,
} from './profileHelper';

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

test('getInjectedUserCurrentProfile 含职业路径与短板 L3 Graph', () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fakeLocalStorage, configurable: true });
  try {
    store.set('super_agent_user_id', 'lzhmy');
    store.set('superme_career', JSON.stringify({
      history: '高级经理',
      current: '总监',
      target: '合伙人',
      progress: 41,
    }));
    // 经 accountStorage API 写入分桶键，避免手写前缀漂移
    const { setLearnItem, writeProfileLocalForUser } = require('./accountStorage') as typeof import('./accountStorage');
    writeProfileLocalForUser('lzhmy', '英国听辨断层');
    setLearnItem('lzhmy', 'user_memory_layers', JSON.stringify({
      l3_vars: { accent: 'UK', training_goal: '即兴表达' },
      l2_graph: {
        relations: [{ from: '用户', rel: '弱点', to: '商务听辨', evidence: '测试' }],
      },
    }));
    const out = getInjectedUserCurrentProfile({ theme: '谈判' });
    assert.equal(out.includes('能力匹配度=41%'), true, `missing career: ${out}`);
    assert.equal(out.includes('英国听辨断层'), true, `missing weakness: ${out}`);
    assert.equal(out.includes('Accent:UK'), true, `missing accent: ${out}`);
    assert.equal(out.includes('Graph:'), true, `missing graph: ${out}`);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});
