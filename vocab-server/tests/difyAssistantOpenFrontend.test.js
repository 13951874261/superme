/**
 * 呼出独立对话大屏：iframe 按登录账号带 sys.user_id；先打 embed-session；3s 内打开。
 * 运行：node vocab-server/tests/difyAssistantOpenFrontend.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const chatbot = fs.readFileSync(path.join(root, 'src/utils/difyChatbot.ts'), 'utf8');
const frame = fs.readFileSync(path.join(root, 'src/components/DifyAssistantFrame.tsx'), 'utf8');
const chatModule = fs.readFileSync(path.join(root, 'src/components/ChatModule.tsx'), 'utf8');

assert.match(chatModule, /呼出独立对话大屏/, '入口按钮必须仍是呼出独立对话大屏');
assert.match(chatbot, /\/api\/dify\/embed-session/, '打开大屏必须先按登录账号查 embed-session');
assert.match(chatbot, /sys\.user_id/, 'iframe 必须传 Dify 文档要求的 sys.user_id');
assert.match(chatbot, /sys\.conversation_id/, '找到历史时必须把 conversation_id 带进 iframe');
assert.match(chatbot, /EMBED_SESSION_BUDGET_MS/, '必须有查找超时预算');
assert.match(chatbot, /2500/, '查找预算须 ≤2500ms，保证 3s 内打开 iframe');
assert.doesNotMatch(
  chatbot,
  /buildMinimalIframeUrl[\s\S]{0,400}user_id:\s*userId/,
  '首帧不得再用无法识别的 user_id= 导致落到 DEFAULT 死会话'
);
assert.doesNotMatch(
  chatbot,
  /iframe\.src = url/,
  '禁止首帧后再热替换 iframe.src，避免超过 3s 或冲掉已打开的历史会话'
);
assert.match(frame, /正在查找对话历史|正在连接答疑助手/, '3s 内必须有可见反馈，禁止白屏');

console.log('difyAssistantOpenFrontend.test.js passed');
