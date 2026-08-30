/**
 * 空 sidecar 不得覆盖本地桶；有 JSON 才 apply。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { learnKey } from '../utils/accountStorage';

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
  };
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (fn: () => void) => {
      fn();
      return 1 as any;
    },
    clearTimeout: () => {},
  };
  return store;
}

test('loadLearningUi：服务端 null 不覆盖本地夜话', async () => {
  const store = installLocalStorage();
  store.set('super_agent_user_id', 'alice');
  store.set(learnKey('alice', 'superme_weekly_history_enhanced'), JSON.stringify([{ id: '1', userContent: '本地夜话' }]));

  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({ success: true, data: { userId: 'alice', learning_ui: null } }),
  });

  const { loadLearningUiFromServer } = await import('../services/learningUiAPI.ts');
  await loadLearningUiFromServer('alice');
  const raw = store.get(learnKey('alice', 'superme_weekly_history_enhanced'));
  assert.ok(raw?.includes('本地夜话'));
});
