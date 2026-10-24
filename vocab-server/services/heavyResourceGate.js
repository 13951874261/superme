const fs = require('node:fs');
const os = require('node:os');

const MiB = 1024 ** 2;
const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason || new DOMException('Aborted', 'AbortError')); }, { once: true });
});
function busy(light = false) { const error = new Error(light ? '服务器繁忙，请稍后重试' : 'Heavy resource gate timed out'); error.errorCode = 'RESOURCE_BUSY'; error.retryable = true; if (light) error.httpStatus = 503; return error; }

function inspectHost({ read = (name) => fs.readFileSync(name, 'utf8'), freeMemory = os.freemem, loadAverage = os.loadavg, cpuCount = () => os.cpus().length, Magnitude = MiB } = {}) {
  let swapUsed = 0; let cgroupAvailable = Infinity; let cpuQuota = Infinity;
  try {
    const values = Object.fromEntries(read('/proc/meminfo').split('\n').map((line) => line.match(/^(\w+):\s+(\d+)/)).filter(Boolean).map((match) => [match[1], Number(match[2]) / 1024]));
    swapUsed = Math.max(0, (values.SwapTotal || 0) - (values.SwapFree || 0));
  } catch {}
  try { const maximum = read('/sys/fs/cgroup/memory.max').trim(); if (maximum !== 'max') cgroupAvailable = Math.max(0, (Number(maximum) - Number(read('/sys/fs/cgroup/memory.current'))) / Magnitude); } catch {}
  try { const [quota, period] = read('/sys/fs/cgroup/cpu.max').trim().split(/\s+/); if (quota !== 'max') cpuQuota = Number(quota) / Number(period); } catch {}
  return { availableMemory: Math.min(freeMemory() / Magnitude, cgroupAvailable), swapUsed, loadAverage: (loadAverage()[0] || 0) / Math.max(1, Math.min(cpuCount(), cpuQuota)) };
}

function createHeavyResourceGate({ inspect = inspectHost, sleep = wait, profile = process.env.BOOK_MVP_PROFILE || 'full', pollMs = 5000, maxWaitMs = 60_000, thresholds = {} } = {}) {
  const light = profile === 'light';
  const limits = { minAvailableMemory: light ? 800 : 1200, maxSwapUsed: light ? Infinity : 512, maxLoadAverage: light ? 1 : 2, ...thresholds };
  let tail = Promise.resolve();
  async function ready(signal) {
    const deadline = Date.now() + (light ? 0 : maxWaitMs);
    for (;;) {
      signal?.throwIfAborted(); const state = inspect();
      if (state.availableMemory >= limits.minAvailableMemory && state.swapUsed < limits.maxSwapUsed && state.loadAverage <= limits.maxLoadAverage) return;
      if (Date.now() >= deadline) throw busy(light);
      await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())), signal);
    }
  }
  return {
    run(work, { signal } = {}) {
      const result = tail.then(async () => { await ready(signal); return work(); });
      tail = result.catch(() => {});
      return result;
    },
  };
}

const globalHeavyResourceGate = createHeavyResourceGate();
module.exports = { createHeavyResourceGate, globalHeavyResourceGate, inspectHost };
