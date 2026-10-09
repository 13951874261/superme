function initFreeOralTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS free_oral_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      focus_topic TEXT NOT NULL DEFAULT '',
      dify_conversation_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS free_oral_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      client_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'completed'
    );
    CREATE INDEX IF NOT EXISTS idx_free_oral_sessions_user_updated
      ON free_oral_sessions(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_free_oral_messages_session_created
      ON free_oral_messages(user_id, session_id, created_at);
  `);
  const columns = db.prepare('PRAGMA table_info(free_oral_messages)').all().map((column) => column.name);
  if (!columns.includes('client_message_id')) db.exec('ALTER TABLE free_oral_messages ADD COLUMN client_message_id TEXT');
  if (!columns.includes('status')) db.exec("ALTER TABLE free_oral_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'");
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_free_oral_messages_client
    ON free_oral_messages(session_id, client_message_id) WHERE client_message_id IS NOT NULL`);
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    focusTopic: row.focus_topic || '',
    conversationId: row.dify_conversation_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    clientMessageId: row.client_message_id || null,
    status: row.status || 'completed',
  };
}

function createFreeOralSession(db, { id, userId, title = '新对话', now = Date.now() }) {
  db.prepare(`
    INSERT INTO free_oral_sessions (id, user_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, String(title || '新对话').trim().slice(0, 80) || '新对话', now, now);
  return getFreeOralSession(db, { sessionId: id, userId, withMessages: false });
}

function listFreeOralSessions(db, { userId }) {
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM free_oral_messages m WHERE m.session_id = s.id AND m.user_id = s.user_id) AS message_count,
      (SELECT m.content FROM free_oral_messages m
        WHERE m.session_id = s.id AND m.user_id = s.user_id AND m.status = 'completed'
        ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message,
      (SELECT m.created_at FROM free_oral_messages m
        WHERE m.session_id = s.id AND m.user_id = s.user_id AND m.status = 'completed'
        ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message_at
    FROM free_oral_sessions s
    WHERE s.user_id = ?
    ORDER BY s.updated_at DESC, s.created_at DESC
  `).all(userId).map((row) => ({
    ...mapSession(row),
    messageCount: Number(row.message_count || 0),
    lastMessage: row.last_message || '',
    lastMessageAt: row.last_message_at || null,
  }));
}

function getFreeOralSession(db, { sessionId, userId, withMessages = true }) {
  const session = mapSession(db.prepare(`
    SELECT * FROM free_oral_sessions WHERE id = ? AND user_id = ?
  `).get(sessionId, userId));
  if (!session || !withMessages) return session;
  session.messages = db.prepare(`
    SELECT id, role, content, created_at, client_message_id, status FROM free_oral_messages
    WHERE session_id = ? AND user_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(sessionId, userId).map(mapMessage);
  return session;
}

function updateFreeOralSession(db, {
  sessionId,
  userId,
  title,
  focusTopic,
  conversationId,
  now = Date.now(),
}) {
  const current = getFreeOralSession(db, { sessionId, userId, withMessages: false });
  if (!current) return null;
  db.prepare(`
    UPDATE free_oral_sessions
    SET title = ?, focus_topic = ?, dify_conversation_id = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    title === undefined ? current.title : (String(title).trim().slice(0, 80) || '新对话'),
    focusTopic === undefined ? current.focusTopic : String(focusTopic).trim().slice(0, 100),
    conversationId === undefined ? current.conversationId : (conversationId || null),
    now,
    sessionId,
    userId,
  );
  return getFreeOralSession(db, { sessionId, userId, withMessages: false });
}

function addFreeOralMessage(db, {
  id,
  sessionId,
  userId,
  role,
  content,
  now = Date.now(),
}) {
  if (!getFreeOralSession(db, { sessionId, userId, withMessages: false })) {
    throw new Error('会话不存在或无权访问');
  }
  if (!['user', 'assistant', 'system'].includes(role)) throw new Error('消息角色无效');
  const text = String(content || '').trim();
  if (!text) throw new Error('消息内容不能为空');
  const maxLength = role === 'assistant' ? 10000 : 4000;
  if (text.length > maxLength) throw new Error(`消息内容不能超过 ${maxLength} 个字符`);
  db.prepare(`
    INSERT OR IGNORE INTO free_oral_messages (id, session_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, role, text, now);
  db.prepare(`UPDATE free_oral_sessions SET updated_at = ? WHERE id = ? AND user_id = ?`)
    .run(now, sessionId, userId);
  const saved = db.prepare(`
    SELECT id, role, content, created_at FROM free_oral_messages
    WHERE id = ? AND session_id = ? AND user_id = ?
  `).get(id, sessionId, userId);
  if (!saved) throw new Error('消息 id 已被占用');
  return mapMessage(saved);
}

function beginFreeOralTurn(db, {
  id,
  clientMessageId,
  sessionId,
  userId,
  content,
  now = Date.now(),
}) {
  if (!getFreeOralSession(db, { sessionId, userId, withMessages: false })) throw new Error('会话不存在或无权访问');
  const text = String(content || '').trim();
  if (!text) throw new Error('消息内容不能为空');
  if (text.length > 4000) throw new Error('消息内容不能超过 4000 个字符');
  const key = String(clientMessageId || '').trim();
  if (!key) throw new Error('缺少 clientMessageId');
  const existing = db.prepare(`SELECT id, role, content, created_at, client_message_id, status
    FROM free_oral_messages WHERE session_id = ? AND user_id = ? AND client_message_id = ?`).get(sessionId, userId, key);
  if (existing) {
    if (existing.content !== text || existing.role !== 'user') throw new Error('幂等键已绑定其他消息');
    return mapMessage(existing);
  }
  db.prepare(`INSERT INTO free_oral_messages
    (id, session_id, user_id, role, content, created_at, client_message_id, status)
    VALUES (?, ?, ?, 'user', ?, ?, ?, 'pending')`).run(id, sessionId, userId, text, now, key);
  db.prepare('UPDATE free_oral_sessions SET updated_at = ? WHERE id = ? AND user_id = ?').run(now, sessionId, userId);
  return mapMessage(db.prepare(`SELECT id, role, content, created_at, client_message_id, status
    FROM free_oral_messages WHERE id = ?`).get(id));
}

function completeFreeOralTurn(db, {
  clientMessageId,
  sessionId,
  userId,
  assistantId,
  assistantContent,
  conversationId,
  now = Date.now(),
}) {
  return db.transaction(() => {
    const userMessage = db.prepare(`SELECT id, role, content, created_at, client_message_id, status
      FROM free_oral_messages WHERE session_id = ? AND user_id = ? AND client_message_id = ? AND role = 'user'`)
      .get(sessionId, userId, clientMessageId);
    if (!userMessage) throw new Error('待完成消息不存在');
    const text = String(assistantContent || '').trim();
    if (!text) throw new Error('AI 消息内容不能为空');
    if (text.length > 10000) throw new Error('AI 消息内容不能超过 10000 个字符');
    db.prepare("UPDATE free_oral_messages SET status = 'completed' WHERE id = ?").run(userMessage.id);
    db.prepare(`INSERT OR IGNORE INTO free_oral_messages
      (id, session_id, user_id, role, content, created_at, client_message_id, status)
      VALUES (?, ?, ?, 'assistant', ?, ?, NULL, 'completed')`).run(assistantId, sessionId, userId, text, now);
    db.prepare(`UPDATE free_oral_sessions SET dify_conversation_id = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`).run(conversationId || null, now, sessionId, userId);
    return {
      userMessage: mapMessage(db.prepare(`SELECT id, role, content, created_at, client_message_id, status
        FROM free_oral_messages WHERE id = ?`).get(userMessage.id)),
      assistantMessage: mapMessage(db.prepare(`SELECT id, role, content, created_at, client_message_id, status
        FROM free_oral_messages WHERE id = ?`).get(assistantId)),
      session: getFreeOralSession(db, { sessionId, userId, withMessages: false }),
    };
  })();
}

function failFreeOralTurn(db, { clientMessageId, sessionId, userId, now = Date.now() }) {
  db.prepare(`UPDATE free_oral_messages SET status = 'failed'
    WHERE session_id = ? AND user_id = ? AND client_message_id = ? AND role = 'user'`)
    .run(sessionId, userId, clientMessageId);
  db.prepare('UPDATE free_oral_sessions SET updated_at = ? WHERE id = ? AND user_id = ?').run(now, sessionId, userId);
  const message = db.prepare(`SELECT id, role, content, created_at, client_message_id, status
    FROM free_oral_messages WHERE session_id = ? AND user_id = ? AND client_message_id = ? AND role = 'user'`)
    .get(sessionId, userId, clientMessageId);
  if (!message) throw new Error('待失败消息不存在');
  return mapMessage(message);
}

function deleteFreeOralSession(db, { sessionId, userId }) {
  return db.transaction(() => {
    const found = db.prepare('SELECT 1 FROM free_oral_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId);
    if (!found) return false;
    db.prepare('DELETE FROM free_oral_messages WHERE session_id = ? AND user_id = ?').run(sessionId, userId);
    db.prepare('DELETE FROM free_oral_sessions WHERE id = ? AND user_id = ?').run(sessionId, userId);
    return true;
  })();
}

module.exports = {
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
};
