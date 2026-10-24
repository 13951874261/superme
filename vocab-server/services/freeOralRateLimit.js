function createFreeOralRateLimiter({ windowMs = 60_000, max = 12, now = Date.now } = {}) {
  windowMs = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000;
  max = Number.isFinite(max) && max > 0 ? Math.floor(max) : 12;
  const records = new Map();
  return function checkFreeOralRateLimit(userId) {
    const timestamp = now();
    const valid = (records.get(userId) || []).filter((item) => timestamp - item < windowMs);
    if (valid.length >= max) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (timestamp - valid[0])) / 1000)) };
    }
    valid.push(timestamp);
    records.set(userId, valid);
    if (records.size > 2000) {
      for (const [key, entries] of records) {
        if (!entries.some((item) => timestamp - item < windowMs)) records.delete(key);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

module.exports = { createFreeOralRateLimiter };
