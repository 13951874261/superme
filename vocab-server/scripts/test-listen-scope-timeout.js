const assert = require('assert');

const dailyListenService = require('../services/dailyListenPreGenerateService');
const { readWithIdleTimeout } = require('../services/streamIdleTimeout');

function testResolveListenDurations() {
  assert.deepStrictEqual(
    dailyListenService.resolveListenDurations({ source: 'login-catchup' }),
    [1],
    '登录补跑默认只跑 1 分钟',
  );
  assert.deepStrictEqual(
    dailyListenService.resolveListenDurations({ source: 'cron' }),
    [1],
    'cron 默认只跑 1 分钟',
  );
  assert.deepStrictEqual(
    dailyListenService.resolveListenDurations({ source: 'login-catchup', durations: [1, 15] }),
    [1, 15],
    '显式 durations 优先',
  );
}

async function testLoginCatchupOnlyGeneratesDurationOne() {
  const originalGenerate = dailyListenService.generateOneCombo;
  const originalGetCombo = dailyListenService.getPregeneratedCombo;
  const calls = [];

  dailyListenService.getPregeneratedCombo = () => ({ status: 'missing' });
  dailyListenService.generateOneCombo = async (_db, raw) => {
    calls.push(Number(raw.duration));
    return { status: 'ready' };
  };

  try {
    const summary = await dailyListenService.runDailyListenForUser(
      { prepare() { return { all() { return []; }, get() { return undefined; } }; } },
      { user_id: 'scope-user', theme: '主题' },
      { source: 'login-catchup', skipReadyAudio: true, packDate: '2026-08-03' },
    );
    assert.ok(calls.length > 0, '应生成至少一组');
    assert.ok(calls.every((d) => d === 1), `登录补跑只能生成 duration=1，实际=${JSON.stringify(calls)}`);
    assert.strictEqual(calls.length, 16, '4 体裁 × 4 等级 × 1 时长 = 16');
    assert.strictEqual(summary.combosOk, 16);
  } finally {
    dailyListenService.generateOneCombo = originalGenerate;
    dailyListenService.getPregeneratedCombo = originalGetCombo;
  }
}

async function testCronOnlyGeneratesDurationOne() {
  const originalGenerate = dailyListenService.generateOneCombo;
  const originalGetCombo = dailyListenService.getPregeneratedCombo;
  const durationSet = new Set();

  dailyListenService.getPregeneratedCombo = () => ({ status: 'missing' });
  dailyListenService.generateOneCombo = async (_db, raw) => {
    durationSet.add(Number(raw.duration));
    return { status: 'ready' };
  };

  try {
    await dailyListenService.runDailyListenForUser(
      { prepare() { return { all() { return []; }, get() { return undefined; } }; } },
      { user_id: 'cron-scope-user', theme: '主题' },
      { source: 'cron', packDate: '2026-08-03' },
    );
    assert.deepStrictEqual([...durationSet], [1]);
  } finally {
    dailyListenService.generateOneCombo = originalGenerate;
    dailyListenService.getPregeneratedCombo = originalGetCombo;
  }
}

async function testStreamIdleTimeout() {
  async function* slowStream() {
    yield Buffer.from('data: {"answer":"hi"}\n\n');
    await new Promise((r) => setTimeout(r, 80));
    yield Buffer.from('data: {"answer":"there"}\n\n');
  }

  await assert.rejects(
    async () => {
      for await (const _chunk of readWithIdleTimeout(slowStream(), { idleTimeoutMs: 30 })) {
        // drain
      }
    },
    /idle timeout/i,
  );
}

async function testStreamIdleTimeoutResetsOnChunk() {
  async function* pacedStream() {
    yield Buffer.from('a');
    await new Promise((r) => setTimeout(r, 20));
    yield Buffer.from('b');
    await new Promise((r) => setTimeout(r, 20));
    yield Buffer.from('c');
  }

  const chunks = [];
  for await (const chunk of readWithIdleTimeout(pacedStream(), { idleTimeoutMs: 50 })) {
    chunks.push(Buffer.from(chunk).toString());
  }
  assert.deepStrictEqual(chunks, ['a', 'b', 'c']);
}

async function main() {
  testResolveListenDurations();
  console.log('PASS resolveListenDurations');
  await testLoginCatchupOnlyGeneratesDurationOne();
  console.log('PASS login catchup only duration=1');
  await testCronOnlyGeneratesDurationOne();
  console.log('PASS cron only duration=1');
  await testStreamIdleTimeout();
  console.log('PASS stream idle timeout');
  await testStreamIdleTimeoutResetsOnChunk();
  console.log('PASS stream idle timeout resets');
  console.log('\nAll listen-scope-timeout tests passed');
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exit(1);
});
