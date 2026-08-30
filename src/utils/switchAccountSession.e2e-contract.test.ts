/**
 * E1/E3/E4/E5/E7 行为级契约：模拟同机换号 localStorage + flush/load 顺序。
 * 不替代真实浏览器，但覆盖 test-spec E 路径的数据隔离不变量。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { learnKey } from './accountStorage';

type Store = Map<string, string>;

function installEnv() {
  const store: Store = new Map();
  const events: string[] = [];
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
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (fn: () => void) => {
      fn();
      return 1 as any;
    },
    clearTimeout: () => {},
  };
  return { store, events };
}

test('E1/E5: 换到空 alice 后不得读到 lzhmy 画像/复盘/材料', async () => {
  const { store, events } = installEnv();
  store.set('super_agent_user_id', 'lzhmy');
  store.set(learnKey('lzhmy', 'User_Current_Profile'), '对抗性沟通怯懦');
  store.set(learnKey('lzhmy', 'user_current_profile'), '对抗性沟通怯懦');
  store.set(learnKey('lzhmy', 'superme_biweekly_review_history'), JSON.stringify([{ id: 'r1', factors: '瑕疵' }]));
  store.set(learnKey('lzhmy', 'super_agent_last_generated_article'), 'lzhmy长文');
  store.set(learnKey('lzhmy', 'super_agent_material_article'), 'lzhmy材料');
  // 无前缀脏键（禁止回退）
  store.set('User_Current_Profile', '对抗性沟通怯懦');

  const puts: Array<{ userId: string; body: any }> = [];
  const gets: string[] = [];
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PUT' && u.includes('/api/user/learning-ui')) {
      const body = JSON.parse(String(init.body || '{}'));
      puts.push({ userId: body.userId, body });
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (u.includes('/api/user/learning-ui/')) {
      gets.push(u);
      return { ok: true, json: async () => ({ success: true, data: { learning_ui: null } }) };
    }
    if (u.includes('/api/user/profile/')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { profile_content: '', updated_at: 0, error_ledger: {}, memory_layers: {} },
        }),
      };
    }
    if (u.includes('/api/user/login-ping')) {
      return { ok: true, json: async () => ({ success: true }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  // 动态导入保证吃到本测的 localStorage
  const { switchAccountSession } = await import('./profileHelper.ts');
  const { getStoredProfileRawForUser } = await import('./accountStorage.ts');
  const { learnGet } = await import('./learnLocal.ts');

  await switchAccountSession('alice');

  assert.equal(store.get('super_agent_user_id'), 'alice');
  assert.equal(getStoredProfileRawForUser('alice'), '');
  assert.equal(learnGet('super_agent_last_generated_article'), null);
  assert.equal(learnGet('super_agent_material_article'), null);
  assert.equal(learnGet('superme_biweekly_review_history'), null);
  // lzhmy 桶仍在
  assert.equal(store.get(learnKey('lzhmy', 'user_current_profile')), '对抗性沟通怯懦');
  // flush 先于改号目标：puts 应含 lzhmy
  assert.ok(puts.some((p) => p.userId === 'lzhmy'), 'E7/E3: flush old account');
  // remount 信号在 load 之后：global-user-id-changed 应出现
  assert.ok(events.includes('global-user-id-changed'));
});

test('E3/E7: 未保存夜话 flush 到旧账号；alice 加载后无该夜话；换回可水合', async () => {
  const { store } = installEnv();
  store.set('super_agent_user_id', 'lzhmy');
  const weekly = [{ id: 'w1', userContent: '未保存夜话内容', date: '2026-08-30' }];
  store.set(learnKey('lzhmy', 'superme_weekly_history_enhanced'), JSON.stringify(weekly));
  store.set(learnKey('lzhmy', 'superme_last_review_date'), '1700000000000');

  let flushedUi: any = null;
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PUT' && u.includes('/api/user/learning-ui')) {
      const body = JSON.parse(String(init.body || '{}'));
      if (body.userId === 'lzhmy') flushedUi = body.learningUi;
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (u.includes('/api/user/learning-ui/alice')) {
      return { ok: true, json: async () => ({ success: true, data: { learning_ui: null } }) };
    }
    if (u.includes('/api/user/learning-ui/lzhmy')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            learning_ui: flushedUi || {
              weeklyChatHistory: weekly,
              lastReviewDate: 1700000000000,
            },
          },
        }),
      };
    }
    if (u.includes('/api/user/profile/')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { profile_content: '', updated_at: 0, error_ledger: {}, memory_layers: {} },
        }),
      };
    }
    return { ok: true, json: async () => ({ success: true }) };
  };

  const { switchAccountSession } = await import('./profileHelper.ts');
  const { learnGet } = await import('./learnLocal.ts');

  await switchAccountSession('alice');
  assert.ok(flushedUi?.weeklyChatHistory?.[0]?.userContent === '未保存夜话内容');
  const aliceWeekly = learnGet('superme_weekly_history_enhanced');
  assert.ok(!aliceWeekly || !aliceWeekly.includes('未保存夜话内容'), 'alice must not see lzhmy weekly');

  await switchAccountSession('lzhmy');
  const back = learnGet('superme_weekly_history_enhanced') || '';
  assert.ok(back.includes('未保存夜话内容'), 'E3: switch back restores weekly from sidecar');
});

test('E4: 背景偏好不分桶，换号后仍共享', async () => {
  const { store } = installEnv();
  store.set('super_agent_user_id', 'lzhmy');
  store.set('super_agent_bg_enabled', 'false');

  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { profile_content: '', updated_at: 0, learning_ui: null },
    }),
  });

  const { switchAccountSession } = await import('./profileHelper.ts');
  const { getPreferenceItem } = await import('./accountStorage.ts');
  await switchAccountSession('alice');
  assert.equal(getPreferenceItem('super_agent_bg_enabled'), 'false');
  assert.equal(store.get('super_agent_bg_enabled'), 'false');
});
