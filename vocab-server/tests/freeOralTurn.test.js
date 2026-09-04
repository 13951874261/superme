const test = require('node:test');
const assert = require('node:assert/strict');
const BetterSqlite3 = require('better-sqlite3');
const {
  createFreeOralSession,
  getFreeOralSession,
  initFreeOralTables,
} = require('../services/freeOralSessions');
const { executeFreeOralTurn } = require('../services/freeOralTurn');

function Database(path) {
  try {
    return new BetterSqlite3(path);
  } catch (nativeError) {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch { throw nativeError; }
    const db = new DatabaseSync(path);
    db.transaction = (work) => (...args) => {
      db.exec('BEGIN');
      try {
        const result = work(...args);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
    return db;
  }
}

test('统一发送：保存用户消息、AI 回复和 conversation_id', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });

  const result = await executeFreeOralTurn(db, {
    sessionId: 's1', userId: 'u1', clientMessageId: 'c1', content: 'Hello', now: () => 1100,
    sendToDify: async ({ query, conversationId, inputs, userId }) => {
      assert.deepEqual({ query, conversationId, inputs, userId }, {
        query: 'Hello', conversationId: null, inputs: { focus_topic: '', user_current_profile: '' }, userId: 'u1',
      });
      return { answer: 'Hi there', conversation_id: 'dify-1' };
    },
  });

  assert.equal(result.userMessage.status, 'completed');
  assert.equal(result.assistantMessage.content, 'Hi there');
  const saved = getFreeOralSession(db, { sessionId: 's1', userId: 'u1' });
  assert.equal(saved.conversationId, 'dify-1');
  assert.deepEqual(saved.messages.map(({ role, status }) => [role, status]), [
    ['user', 'completed'], ['assistant', 'completed'],
  ]);
  db.close();
});

test('统一发送：相同 clientMessageId 不重复调用 Dify', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  let calls = 0;
  const input = {
    sessionId: 's1', userId: 'u1', clientMessageId: 'c1', content: 'Hello', now: () => 1100,
    sendToDify: async () => { calls += 1; return { answer: 'Hi', conversation_id: 'd1' }; },
  };

  const first = await executeFreeOralTurn(db, input);
  const second = await executeFreeOralTurn(db, input);
  assert.equal(calls, 1);
  assert.equal(second.assistantMessage.id, first.assistantMessage.id);
  assert.equal(getFreeOralSession(db, { sessionId: 's1', userId: 'u1' }).messages.length, 2);
  db.close();
});

test('统一发送：pending 幂等键不得触发第二次 Dify 调用', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  let release;
  let calls = 0;
  const pendingDify = new Promise((resolve) => { release = resolve; });
  const input = {
    sessionId: 's1', userId: 'u1', clientMessageId: 'c1', content: 'Hello', now: () => 1100,
    sendToDify: async () => { calls += 1; return pendingDify; },
  };

  const first = executeFreeOralTurn(db, input);
  await assert.rejects(executeFreeOralTurn(db, input), /发送处理中/);
  assert.equal(calls, 1);
  release({ answer: 'Hi', conversation_id: 'd1' });
  await first;
  db.close();
});

test('统一发送：conversation_id 失效时使用最近六轮恢复一次', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  const seed = [
    ['u0', 'c0', 'Question 0', 'Answer 0'], ['u1', 'c1', 'Question 1', 'Answer 1'],
    ['u2', 'c2', 'Question 2', 'Answer 2'], ['u3', 'c3', 'Question 3', 'Answer 3'],
    ['u4', 'c4', 'Question 4', 'Answer 4'], ['u5', 'c5', 'Question 5', 'Answer 5'],
    ['u6', 'c6', 'Question 6', 'Answer 6'],
  ];
  seed.forEach(([id, clientMessageId, question, answer], index) => {
    const { beginFreeOralTurn, completeFreeOralTurn } = require('../services/freeOralSessions');
    beginFreeOralTurn(db, { id, clientMessageId, sessionId: 's1', userId: 'u1', content: question, now: 1100 + index * 10 });
    completeFreeOralTurn(db, {
      clientMessageId, sessionId: 's1', userId: 'u1', assistantId: `a-${id}`,
      assistantContent: answer, conversationId: 'expired-id', now: 1101 + index * 10,
    });
  });
  const calls = [];
  const result = await executeFreeOralTurn(db, {
    sessionId: 's1', userId: 'u1', clientMessageId: 'new', content: 'Continue', now: () => 1300,
    sendToDify: async (request) => {
      calls.push(request);
      if (calls.length === 1) {
        const error = new Error('Conversation Not Exists.');
        error.code = 'conversation_not_exists';
        throw error;
      }
      return { answer: 'Recovered answer', conversation_id: 'new-id' };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].conversationId, null);
  assert.match(calls[1].inputs.recovery_context, /Question 1/);
  assert.doesNotMatch(calls[1].inputs.recovery_context, /Question 0/);
  assert.match(calls[1].inputs.recovery_context, /Answer 6/);
  assert.equal(result.recovered, true);
  assert.equal(result.session.conversationId, 'new-id');
  db.close();
});

test('统一发送：非会话失效错误不得自动重试', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  let calls = 0;
  await assert.rejects(executeFreeOralTurn(db, {
    sessionId: 's1', userId: 'u1', clientMessageId: 'c1', content: 'Hello', now: () => 1100,
    sendToDify: async () => { calls += 1; throw new Error('upstream unavailable'); },
  }), /upstream unavailable/);
  assert.equal(calls, 1);
  db.close();
});

test('统一发送：Dify 失败后消息标记 failed，同幂等键可重试', async () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  let calls = 0;
  const input = {
    sessionId: 's1', userId: 'u1', clientMessageId: 'c1', content: 'Hello', now: () => 1100,
    sendToDify: async () => {
      calls += 1;
      if (calls === 1) throw new Error('upstream unavailable');
      return { answer: 'Recovered', conversation_id: 'd2' };
    },
  };

  await assert.rejects(executeFreeOralTurn(db, input), /upstream unavailable/);
  assert.equal(getFreeOralSession(db, { sessionId: 's1', userId: 'u1' }).messages[0].status, 'failed');
  const retried = await executeFreeOralTurn(db, input);
  assert.equal(retried.userMessage.status, 'completed');
  assert.equal(calls, 2);
  db.close();
});
