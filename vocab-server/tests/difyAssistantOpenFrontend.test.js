/**
 * 呼出独立对话大屏：sys.* 必须 gzip+base64（Dify 解码失败会当成 DEFAULT，读死会话 404）。
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
assert.match(chatbot, /sys\.user_id/, 'iframe 必须传 Dify 文档要求的 sys.user_id');
assert.match(
  chatbot,
  /params\.set\(['"]sys\.user_id['"], await compressAndEncodeBase64\(userId\)\)/,
  'sys.user_id 必须 gzip+base64，明文会被 Dify 解压失败后丢弃并落到 DEFAULT'
);
assert.match(
  chatbot,
  /params\.set\(`sys\.\$\{key\}`, await compressAndEncodeBase64\(valStr\)\)/,
  'systemVariables 一律 gzip，禁止对 user_id/conversation_id 走明文'
);
assert.doesNotMatch(
  chatbot,
  /key === 'user_id' \|\| key === 'conversation_id' \|\| valStr\.length < 60/,
  '禁止短 sys 参数明文写入 URL'
);
assert.doesNotMatch(
  chatbot,
  /export async function prepareDifyAssistantIframe[\s\S]{0,500}fetchEmbedConversationId/,
  '打开大屏不得等待 Service API 会话 ID（与 Web iframe 会话池不通）'
);
assert.doesNotMatch(
  chatbot,
  /iframe\.src = url/,
  '禁止首帧后再热替换 iframe.src'
);
assert.match(frame, /正在查找对话历史|正在连接答疑助手/, '3s 内必须有可见反馈，禁止白屏');

console.log('difyAssistantOpenFrontend.test.js passed');
