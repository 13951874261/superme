/**
 * Wrap an async iterable so that if no chunk arrives within idleTimeoutMs, it rejects.
 * Each received chunk resets the idle timer.
 */
function resolveDifyStreamIdleTimeout({ idleTimeoutMs, longArticle = false } = {}) {
  return [idleTimeoutMs, longArticle && process.env.DIFY_LONG_ARTICLE_STREAM_IDLE_TIMEOUT_MS,
    process.env.DIFY_STREAM_IDLE_TIMEOUT_MS].map(Number)
    .find(n => Number.isInteger(n) && n > 0 && n <= 2147483647) || (longArticle ? 300000 : 120000);
}

async function* readWithIdleTimeout(asyncIterable, { idleTimeoutMs = 120000, onTimeout } = {}) {
  const iterator = asyncIterable[Symbol.asyncIterator]();
  let idleTimer = null;
  let timedOut = false;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const waitNext = () => new Promise((resolve, reject) => {
    clearIdle();
    idleTimer = setTimeout(() => {
      timedOut = true;
      if (typeof onTimeout === 'function') {
        try { onTimeout(); } catch (_) {}
      }
      reject(new Error(`stream idle timeout after ${idleTimeoutMs}ms`));
    }, idleTimeoutMs);

    Promise.resolve(iterator.next()).then(
      (result) => {
        clearIdle();
        resolve(result);
      },
      (error) => {
        clearIdle();
        reject(error);
      },
    );
  });

  try {
    while (true) {
      const { done, value } = await waitNext();
      if (done) return;
      yield value;
    }
  } finally {
    clearIdle();
    if (typeof iterator.return === 'function') {
      try {
        const cleanup = Promise.resolve(iterator.return()).catch(() => {});
        // 超时后不能等待卡住的 next()，否则上层重试永远无法开始。
        if (!timedOut) await cleanup;
      } catch (_) {}
    }
  }
}

module.exports = {
  readWithIdleTimeout,
  resolveDifyStreamIdleTimeout,
};
