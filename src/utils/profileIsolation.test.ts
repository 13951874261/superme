import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * U3/U4/U5 契约：loadUserProfileFromServer 不得用他账号无前缀键写脏。
 * 通过静态审计 + accountStorage 行为断言（不启真实 fetch）。
 */
import {
  getStoredProfileRawForUser,
  learnKey,
  setLearnItem,
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

test('U3/U12: 无前缀全局键有 lzhmy 画像时，alice 桶读为空', () => {
  const fake = makeFakeLocalStorage();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    fake.setItem('User_Current_Profile', '对抗性沟通怯懦');
    fake.setItem('user_current_profile', '对抗性沟通怯懦');
    assert.equal(getStoredProfileRawForUser('alice'), '');
    writeProfileLocalForUser('lzhmy', '对抗性沟通怯懦', Date.now());
    assert.equal(getStoredProfileRawForUser('lzhmy'), '对抗性沟通怯懦');
    assert.equal(getStoredProfileRawForUser('alice'), '');
    assert.ok(fake.store.has(learnKey('lzhmy', 'User_Current_Profile')));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});

test('U5: alice 服务端画像写入只影响 alice 桶', () => {
  const fake = makeFakeLocalStorage();
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    writeProfileLocalForUser('lzhmy', 'lzhmy-profile');
    writeProfileLocalForUser('alice', 'alice-server-profile', 100);
    assert.equal(getStoredProfileRawForUser('alice'), 'alice-server-profile');
    assert.equal(getStoredProfileRawForUser('lzhmy'), 'lzhmy-profile');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});

test('profileHelper 源码：load 失败路径不得 sync 无桶内容', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const file = path.join(process.cwd(), 'src/utils/profileHelper.ts');
  const src = fs.readFileSync(file, 'utf8');
  assert.match(src, /getStoredProfileRawForUser/);
  assert.match(src, /maybeSyncOwnBucket/);
  assert.doesNotMatch(
    src,
    /if \(!res\.ok\) \{\s*if \(localRaw\) void syncProfileToServer\(localRaw\)/,
  );
  assert.match(src, /writeProfileLocalForUser|writeProfileLocal\([^)]*uid/);
});
