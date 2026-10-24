/**
 * U13：english_theme / pending_debt 必须分桶，无前缀键不得作为 alice 初始 UI。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { learnKey } from './accountStorage';

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
  };
  return store;
}

test('U13: alice 读 theme/debt 不回落无前缀全局键', async () => {
  const store = installLocalStorage();
  store.set('super_agent_user_id', 'alice');
  store.set('english_theme', 'lzhmy主题残留');
  store.set('super_agent_pending_debt', 'lzhmy债务');
  const { learnGet } = await import('./learnLocal.ts');
  assert.equal(learnGet('english_theme'), null);
  assert.equal(learnGet('super_agent_pending_debt'), null);
  assert.equal(store.get('english_theme'), 'lzhmy主题残留');
  assert.ok(!store.has(learnKey('alice', 'english_theme')));
});
