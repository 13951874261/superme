import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmRequestCoordinator } from './confirmRequestCoordinator';

test('后请求取消前请求且仅匹配 id 的 close 可结算', async () => {
  const coordinator = createConfirmRequestCoordinator();
  const first = coordinator.create();
  const second = coordinator.create();

  assert.equal(await first.result, false);
  assert.equal(coordinator.settle(first.id, true), false);
  assert.equal(coordinator.settle(second.id, true), true);
  assert.equal(await second.result, true);
});

test('同步 settled 门闩阻止同一请求双重结算', async () => {
  const coordinator = createConfirmRequestCoordinator();
  const request = coordinator.create();

  assert.equal(coordinator.settle(request.id, true), true);
  assert.equal(coordinator.settle(request.id, false), false);
  assert.equal(await request.result, true);
});

test('Host 卸载取消当前请求但旧 cleanup 不清空新 Host emitter', async () => {
  const coordinator = createConfirmRequestCoordinator();
  const oldHost = coordinator.mount(() => {});
  const pending = coordinator.create();
  const newEvents: number[] = [];
  coordinator.mount((id) => newEvents.push(id));

  oldHost();
  assert.equal(await pending.result, false);
  const next = coordinator.create();
  assert.deepEqual(newEvents, [next.id]);
});
