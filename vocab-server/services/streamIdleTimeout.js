/**
 * Wrap an async iterable so that if no chunk arrives within idleTimeoutMs, it rejects.
 * Each received chunk resets the idle timer.
 */
async function* readWithIdleTimeout(asyncIterable, { idleTimeoutMs = 120000 } = {}) {
  const iterator = asyncIterable[Symbol.asyncIterator]();
  let idleTimer = null;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const waitNext = () => new Promise((resolve, reject) => {
    clearIdle();
    idleTimer = setTimeout(() => {
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
      try { await iterator.return(); } catch (_) {}
    }
  }
}

module.exports = {
  readWithIdleTimeout,
};
