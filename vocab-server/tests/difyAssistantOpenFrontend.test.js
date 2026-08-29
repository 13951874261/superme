/**
 * 呼出独立对话大屏：避开 Dify 域 DEFAULT 死会话；sys.user_id gzip；iframe 隔离存储。
 * 运行：node vocab-server/tests/difyAssistantOpenFrontend.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const chatbot = fs.readFileSync(path.join(root, 'src/utils/difyChatbot.ts'), 'utf8');
const frame = fs.readFileSync(path.join(root, 'src/components/DifyAssistantFrame.tsx'), 'utf8');
const chatModule = fs.readFileSync(path.join(root, 'src/components/ChatModule.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');

assert.match(chatModule, /呼出独立对话大屏/, '入口按钮必须仍是呼出独立对话大屏');
assert.match(chatbot, /@embed2/, '必须换独立 embed 用户槽，避开 DEFAULT/旧 ID 死会话');
assert.match(
  chatbot,
  /params\.set\(['"]sys\.user_id['"], await compressAndEncodeBase64\(embedUserId\)\)/,
  'sys.user_id 必须 gzip 后的 embed 用户'
);
assert.match(
  chatbot,
  /params\.set\(['"]app_user_id['"], await compressAndEncodeBase64\(accountId\)\)/,
  'app_user_id 必须 gzip，否则开始对话表单拿不到登录账号'
);
assert.match(frame, /credentialless/, '可见 iframe 必须隔离 Dify 域 localStorage，否则会继续读死会话 404');
assert.doesNotMatch(
  app,
  /iframeRef\.current\.src = url/,
  '禁止隐藏预加载 iframe 去打 Dify（会污染同源 conversationIdInfo）'
);
assert.match(frame, /正在查找对话历史|正在连接答疑助手/, '3s 内必须有可见反馈');

console.log('difyAssistantOpenFrontend.test.js passed');
