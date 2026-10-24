import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GT_FOCUS_TAB_KEY,
  GT_FOCUS_TAB_SESSION,
  GT_NAV_SESSION_EVENT,
  requestGameTheorySessionFocus,
  consumeGameTheorySessionFocus,
} from './gtFocusTab';

test('常量', () => {
  assert.equal(GT_FOCUS_TAB_KEY, 'gt_focus_tab');
  assert.equal(GT_FOCUS_TAB_SESSION, 'session');
  assert.equal(GT_NAV_SESSION_EVENT, 'navigate-gametheory-session');
});

test('request 写入 session；consume 读出并清除', () => {
  const store = new Map<string, string>();
  const fakeSession = {
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

  requestGameTheorySessionFocus({ sessionStorage: fakeSession, win: fakeWindow });
  assert.equal(store.get(GT_FOCUS_TAB_KEY), 'session');
  assert.deepEqual(events, [GT_NAV_SESSION_EVENT]);

  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), true);
  assert.equal(store.has(GT_FOCUS_TAB_KEY), false);
  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), false);
});

test('非法值 consume 返回 false 并清除', () => {
  const store = new Map<string, string>([[GT_FOCUS_TAB_KEY, 'cases']]);
  const fakeSession = {
    setItem: (k: string, v: string) => { store.set(k, v); },
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  } as Storage;
  assert.equal(consumeGameTheorySessionFocus({ sessionStorage: fakeSession }), false);
  assert.equal(store.has(GT_FOCUS_TAB_KEY), false);
});
