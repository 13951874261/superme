import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLearnItem,
  getPreferenceItem,
  getStoredProfileRawForUser,
  isPreferenceKey,
  learnKey,
  setLearnItem,
  setPreferenceItem,
  writeProfileLocalForUser,
} from './accountStorage';

function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get store() {
      return store;
    },
  };
}

test('U1: learnKey alice 与 lzhmy 不同，读写互不覆盖', () => {
  const fake = makeFakeLocalStorage();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    assert.notEqual(learnKey('alice', 'User_Current_Profile'), learnKey('lzhmy', 'User_Current_Profile'));
    setLearnItem('lzhmy', 'User_Current_Profile', '对抗性沟通怯懦');
    setLearnItem('alice', 'User_Current_Profile', '');
    assert.equal(getLearnItem('lzhmy', 'User_Current_Profile'), '对抗性沟通怯懦');
    assert.equal(getLearnItem('alice', 'User_Current_Profile'), '');
    assert.ok(!fake.store.has('User_Current_Profile'), '不得写无前缀全局键');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});

test('U2: 偏好键 super_agent_bg_enabled 不分桶', () => {
  const fake = makeFakeLocalStorage();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    assert.equal(isPreferenceKey('super_agent_bg_enabled'), true);
    setPreferenceItem('super_agent_bg_enabled', 'false');
    assert.equal(getPreferenceItem('super_agent_bg_enabled'), 'false');
    assert.ok(fake.store.has('super_agent_bg_enabled'));
    assert.ok(![...fake.store.keys()].some((k) => k.includes('sa_learn:') && k.includes('super_agent_bg_enabled')));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});

test('U12: alice 上下文读画像时，无前缀全局键仍是 lzhmy 内容也返回空', () => {
  const fake = makeFakeLocalStorage();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    fake.setItem('User_Current_Profile', '对抗性沟通怯懦');
    fake.setItem('user_current_profile', '对抗性沟通怯懦');
    assert.equal(getStoredProfileRawForUser('alice'), '');
    writeProfileLocalForUser('lzhmy', '对抗性沟通怯懦');
    assert.equal(getStoredProfileRawForUser('lzhmy'), '对抗性沟通怯懦');
    assert.equal(getStoredProfileRawForUser('alice'), '');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});
