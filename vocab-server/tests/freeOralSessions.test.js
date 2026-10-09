const test = require('node:test');
const assert = require('node:assert/strict');
const BetterSqlite3 = require('better-sqlite3');

function Database(path) {
  try {
    return new BetterSqlite3(path);
  } catch (nativeError) {
    // ponytail: local Node ABI may not match better-sqlite3; Node 22+ test fallback only.
    let DatabaseSync;
    try {
      ({ DatabaseSync } = require('node:sqlite'));
    } catch {
      throw nativeError;
    }
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
const {
  addFreeOralMessage,
  beginFreeOralTurn,
  completeFreeOralTurn,
  createFreeOralSession,
  deleteFreeOralSession,
  failFreeOralTurn,
  getFreeOralSession,
  initFreeOralTables,
  listFreeOralSessions,
  updateFreeOralSession,
} = require('../services/freeOralSessions');

test('自由口语会话：CRUD、消息顺序、Dify conversation_id 持久化', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  const created = createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  assert.equal(created.title, '新对话');

  addFreeOralMessage(db, { id: 'm1', sessionId: 's1', userId: 'u1', role: 'user', content: 'Hello', now: 1100 });
  addFreeOralMessage(db, { id: 'm2', sessionId: 's1', userId: 'u1', role: 'assistant', content: 'Hi there', now: 1200 });
  updateFreeOralSession(db, {
    sessionId: 's1',
    userId: 'u1',
    title: 'Hello',
    focusTopic: 'AI governance',
    conversationId: 'dify-1',
    now: 1300,
  });

  const session = getFreeOralSession(db, { sessionId: 's1', userId: 'u1' });
  assert.equal(session.focusTopic, 'AI governance');
  assert.equal(session.conversationId, 'dify-1');
  assert.deepEqual(session.messages.map((item) => [item.role, item.content]), [
    ['user', 'Hello'],
    ['assistant', 'Hi there'],
  ]);
  assert.deepEqual(listFreeOralSessions(db, { userId: 'u1' }).map((item) => item.id), ['s1']);

  assert.equal(deleteFreeOralSession(db, { sessionId: 's1', userId: 'u1' }), true);
  assert.equal(getFreeOralSession(db, { sessionId: 's1', userId: 'u1' }), null);
  db.close();
});

test('自由口语会话列表：返回最近有效消息摘要和消息数', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  addFreeOralMessage(db, { id: 'm1', sessionId: 's1', userId: 'u1', role: 'user', content: 'First question', now: 1100 });
  addFreeOralMessage(db, { id: 'm2', sessionId: 's1', userId: 'u1', role: 'assistant', content: 'Latest answer with enough detail', now: 1200 });
  beginFreeOralTurn(db, { id: 'm3', clientMessageId: 'c3', sessionId: 's1', userId: 'u1', content: 'Pending text', now: 1300 });

  const [summary] = listFreeOralSessions(db, { userId: 'u1' });
  assert.equal(summary.messageCount, 3);
  assert.equal(summary.lastMessage, 'Latest answer with enough detail');
  assert.equal(summary.lastMessageAt, 1200);
  db.close();
});

test('自由口语会话：user_id + session_id 隔离并拒绝跨用户写入', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 'shared', userId: 'owner', now: 1000 });

  assert.equal(getFreeOralSession(db, { sessionId: 'shared', userId: 'attacker' }), null);
  assert.throws(() => addFreeOralMessage(db, {
    id: 'evil', sessionId: 'shared', userId: 'attacker', role: 'user', content: 'steal', now: 1100,
  }), /会话不存在/);
  assert.equal(updateFreeOralSession(db, {
    sessionId: 'shared', userId: 'attacker', focusTopic: 'hijack', now: 1200,
  }), null);
  assert.equal(deleteFreeOralSession(db, { sessionId: 'shared', userId: 'attacker' }), false);
  db.close();
});

test('自由口语消息：相同消息 id 幂等', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  addFreeOralMessage(db, { id: 'same', sessionId: 's1', userId: 'u1', role: 'user', content: 'Hello', now: 1100 });
  addFreeOralMessage(db, { id: 'same', sessionId: 's1', userId: 'u1', role: 'user', content: 'Hello', now: 1200 });
  assert.equal(getFreeOralSession(db, { sessionId: 's1', userId: 'u1' }).messages.length, 1);
  db.close();
});
test('自由口语消息：限制输入长度并拒绝跨会话复用消息 id', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });
  createFreeOralSession(db, { id: 's2', userId: 'u1', now: 1000 });

  assert.throws(() => addFreeOralMessage(db, {
    id: 'too-long', sessionId: 's1', userId: 'u1', role: 'user', content: 'a'.repeat(4001), now: 1100,
  }), /4000/);
  assert.throws(() => addFreeOralMessage(db, {
    id: 'assistant-too-long', sessionId: 's1', userId: 'u1', role: 'assistant', content: 'a'.repeat(10001), now: 1150,
  }), /10000/);

  addFreeOralMessage(db, { id: 'shared-id', sessionId: 's1', userId: 'u1', role: 'user', content: 'Hello', now: 1200 });
  assert.throws(() => addFreeOralMessage(db, {
    id: 'shared-id', sessionId: 's2', userId: 'u1', role: 'user', content: 'Different session', now: 1300,
  }), /消息 id 已被占用/);
  db.close();
});

test('自由口语轮次：pending、completed、failed 状态可持久化', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });

  const pending = beginFreeOralTurn(db, {
    id: 'user-1', clientMessageId: 'client-1', sessionId: 's1', userId: 'u1', content: 'Hello', now: 1100,
  });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.clientMessageId, 'client-1');

  const completed = completeFreeOralTurn(db, {
    clientMessageId: 'client-1', sessionId: 's1', userId: 'u1', assistantId: 'assistant-1',
    assistantContent: 'Hi there', conversationId: 'dify-1', now: 1200,
  });
  assert.equal(completed.userMessage.status, 'completed');
  assert.equal(completed.assistantMessage.status, 'completed');
  assert.equal(completed.session.conversationId, 'dify-1');

  beginFreeOralTurn(db, {
    id: 'user-2', clientMessageId: 'client-2', sessionId: 's1', userId: 'u1', content: 'Retry me', now: 1300,
  });
  assert.equal(failFreeOralTurn(db, {
    clientMessageId: 'client-2', sessionId: 's1', userId: 'u1', now: 1400,
  }).status, 'failed');
  db.close();
});

test('自由口语轮次：同一会话幂等键不得绑定不同正文', () => {
  const db = new Database(':memory:');
  initFreeOralTables(db);
  createFreeOralSession(db, { id: 's1', userId: 'u1', now: 1000 });

  beginFreeOralTurn(db, {
    id: 'user-1', clientMessageId: 'same-client', sessionId: 's1', userId: 'u1', content: 'Original', now: 1100,
  });
  assert.throws(() => beginFreeOralTurn(db, {
    id: 'user-2', clientMessageId: 'same-client', sessionId: 's1', userId: 'u1', content: 'Changed', now: 1200,
  }), /幂等键已绑定其他消息/);
  assert.equal(getFreeOralSession(db, { sessionId: 's1', userId: 'u1' }).messages.length, 1);
  db.close();
});