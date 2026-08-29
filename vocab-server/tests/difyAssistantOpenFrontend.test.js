/**
 * 呼出独立对话大屏：默认跳过新对话设置；关闭面板不卸载 iframe，3 秒内可打开。
 * 运行：node vocab-server/tests/difyAssistantOpenFrontend.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const chatbot = fs.readFileSync(path.join(root, 'src/utils/difyChatbot.ts'), 'utf8');
const frame = fs.readFileSync(path.join(root, 'src/components/DifyAssistantFrame.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/RightPanel.tsx'), 'utf8');
const chatModule = fs.readFileSync(path.join(root, 'src/components/ChatModule.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const yml = fs.readFileSync(path.join(root, 'yml/time_base/mychat_memory_kb.yml'), 'utf8');

assert.match(chatModule, /呼出独立对话大屏/, '入口按钮必须仍是呼出独立对话大屏');
assert.match(chatbot, /@embed3/, '必须换独立 embed 用户槽，避开 DEFAULT/旧 ID 死会话');
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
assert.doesNotMatch(
  chatbot,
  /_refresh:\s*String\(Date\.now\(\)\)/,
  '最小 iframe URL 禁止每次打开都 _refresh 打爆缓存'
);
assert.match(
  frame,
  /credentialless/,
  '可见 iframe 必须隔离 Dify 域 localStorage，否则会继续读死会话 404'
);
assert.match(
  frame,
  /if\s*\(\s*!forceNew\s*\)\s*return/,
  '呼出大屏不得重建 iframe，否则每次都要重新加载 Dify'
);
assert.match(panel, /对话设置/, '需要修改账号/记忆包时用本站弹窗，不默认展开 Dify 开始表单');
assert.match(
  panel,
  /DifyAssistantFrame/,
  '助手 iframe 必须常驻'
);
assert.doesNotMatch(
  panel,
  /\{isOpen && \([\s\S]*DifyAssistantFrame/,
  '关闭右侧面板时不得卸载 Dify iframe'
);
assert.match(
  yml,
  /hide:\s*true[\s\S]{0,80}variable:\s*app_user_id/,
  'app_user_id 必须 Hidden & Pre-Filled，否则会弹出新对话设置'
);
assert.match(
  yml,
  /hide:\s*true[\s\S]{0,80}variable:\s*memory_pack/,
  'memory_pack 必须 Hidden & Pre-Filled，否则会弹出新对话设置'
);
assert.doesNotMatch(
  app,
  /iframeRef\.current\.src = url/,
  '禁止隐藏预加载 iframe 去打 Dify（会污染同源 conversationIdInfo）'
);
assert.match(frame, /正在查找对话历史|正在连接答疑助手|正在打开对话/, '3s 内必须有可见反馈');

console.log('difyAssistantOpenFrontend.test.js passed');
