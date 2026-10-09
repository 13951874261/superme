const crypto = require('node:crypto');
const {
  beginFreeOralTurn,
  completeFreeOralTurn,
  failFreeOralTurn,
  getFreeOralSession,
} = require('./freeOralSessions');

function isConversationMissing(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /conversation[_ ]?(?:not[_ ]?exists|not[_ ]?found|invalid)|invalid[_ ]?conversation/i.test(text);
}

function buildRecoveryContext(messages) {
  const completed = messages.filter((message) => message.status === 'completed' && (message.role === 'user' || message.role === 'assistant'));
  const pairs = [];
  for (let index = 0; index < completed.length - 1; index += 1) {
    if (completed[index].role === 'user' && completed[index + 1].role === 'assistant') {
      pairs.push([completed[index], completed[index + 1]]);
      index += 1;
    }
  }
  return pairs.slice(-6).flatMap(([user, assistant]) => [
    `User: ${user.content}`,
    `Assistant: ${assistant.content}`,
  ]).join('\n');
}

async function executeFreeOralTurn(db, {
  sessionId,
  userId,
  clientMessageId,
  content,
  userCurrentProfile = '',
  sendToDify,
  now = Date.now,
}) {
  const session = getFreeOralSession(db, { sessionId, userId });
  if (!session) throw new Error('会话不存在或无权访问');
  const existingUser = session.messages.find((message) => message.clientMessageId === clientMessageId);
  if (existingUser?.content !== undefined && existingUser.content !== String(content || '').trim()) {
    throw new Error('幂等键已绑定其他消息');
  }
  if (existingUser?.status === 'completed') {
    const index = session.messages.findIndex((message) => message.id === existingUser.id);
    const assistantMessage = session.messages.slice(index + 1).find((message) => message.role === 'assistant');
    if (assistantMessage) return { userMessage: existingUser, assistantMessage, session };
  }
  if (existingUser?.status === 'pending') throw new Error('消息发送处理中');

  const userMessage = beginFreeOralTurn(db, {
    id: existingUser?.id || crypto.randomUUID(),
    clientMessageId,
    sessionId,
    userId,
    content,
    now: now(),
  });
  try {
    const inputs = {
      focus_topic: session.focusTopic,
      user_current_profile: String(userCurrentProfile || ''),
    };
    let recovered = false;
    let response;
    try {
      response = await sendToDify({ query: userMessage.content, conversationId: session.conversationId, inputs, userId });
    } catch (error) {
      if (!session.conversationId || !isConversationMissing(error)) throw error;
      recovered = true;
      response = await sendToDify({
        query: userMessage.content,
        conversationId: null,
        inputs: { ...inputs, recovery_context: buildRecoveryContext(session.messages) },
        userId,
      });
    }
    const answer = String(response?.answer || response?.message || '').trim();
    if (!answer) throw new Error('Dify 未返回有效回复');
    return {
      ...completeFreeOralTurn(db, {
        clientMessageId,
        sessionId,
        userId,
        assistantId: crypto.randomUUID(),
        assistantContent: answer,
        conversationId: response.conversation_id || session.conversationId,
        now: now(),
      }),
      recovered,
    };
  } catch (error) {
    failFreeOralTurn(db, { clientMessageId, sessionId, userId, now: now() });
    throw error;
  }
}

module.exports = { executeFreeOralTurn };
