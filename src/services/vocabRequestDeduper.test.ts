import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestDeduper } from './vocabRequestDeduper';

test('同一键的并发请求复用同一个进行中的 Promise', async () => {
  const dedupe = createRequestDeduper();
  let calls = 0;
  let resolveRequest!: (value: string) => void;
  const request = () => {
    calls += 1;
    return new Promise<string>((resolve) => {
      resolveRequest = resolve;
    });
  };

  const first = dedupe.run('review:light', request);
  const second = dedupe.run('review:light', request);

  assert.strictEqual(first, second);
  assert.equal(calls, 1);

  resolveRequest('ok');
  assert.equal(await first, 'ok');
});

test('请求完成后允许相同键发起新的请求', async () => {
  const dedupe = createRequestDeduper();
  let calls = 0;
  const request = async () => {
    calls += 1;
    return calls;
  };

  assert.equal(await dedupe.run('list:light', request), 1);
  assert.equal(await dedupe.run('list:light', request), 2);
  assert.equal(calls, 2);
});
