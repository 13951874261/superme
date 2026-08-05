import assert from 'node:assert/strict';
import test from 'node:test';
import { loadExpandedVocab } from './vocabLoadCoordinator';

test('展开词库时复用已有的复习缓存而不再次请求 review', async () => {
  let reviewCalls = 0;
  const cachedReview = [{ id: 'cached' }];

  const result = await loadExpandedVocab(
    async () => [{ id: 'list' }],
    cachedReview,
    async () => {
      reviewCalls += 1;
      return [{ id: 'network-review' }];
    }
  );

  assert.deepEqual(result, {
    list: [{ id: 'list' }],
    review: cachedReview,
  });
  assert.equal(reviewCalls, 0);
});
