/**
 * U6：空账号 getLastReviewDate 不得写入 Date.now()
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { learnKey } from './accountStorage';

const USER_ID_KEY = 'super_agent_user_id';
const LAST_KEY = 'superme_last_review_date';

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: () => null,
  };
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return store;
}

test('U6: 空账号读 lastReviewDate 不写桶', async () => {
  const store = installLocalStorage();
  store.set(USER_ID_KEY, 'alice');
  const { getLastReviewDate } = await import('./reviewHelper.ts');
  const before = store.has(learnKey('alice', LAST_KEY));
  assert.equal(before, false);
  const v = getLastReviewDate();
  assert.equal(typeof v, 'number');
  assert.equal(store.has(learnKey('alice', LAST_KEY)), false);
});
