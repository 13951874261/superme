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
assert.match(chatbot, /\/api\/dify\/embed-session/, '打开大屏必须按登录账号向后端查网页侧历史');
assert.match(
  chatbot,
  /params\.set\(['"]sys\.conversation_id['"], await compressAndEncodeBase64\(convId\)\)/,
  '找到有效网页会话后必须 gzip 传入 sys.conversation_id'
);
assert.match(
  chatbot,
  /const embedUserId = String\(sessionUserId \|\| accountId\)/,
  'sys.user_id 必须用找回历史时的网页 session，不能再强行加 @embed 后缀'
);
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
// ponytail: 当前 Dify 导出缩进契约；格式变化时改用 YAML 解析器。
const startInputs = yml.match(/^        type: start\r?\n        variables:\r?\n([\s\S]*?)(?=^      \S)/m)?.[1];
assert(startInputs, '必须存在 start 输入定义');
const inputBlocks = startInputs.split(/^        - /m).slice(1);
for (const variable of ['app_user_id', 'memory_pack']) {
  const block = inputBlocks.find(input => new RegExp('^          variable: ' + variable + '\\r?$', 'm').test(input));
  assert(block && /(?:^|\n)\s*hide: true(?:\r?\n|$)/.test(block), variable + ' 必须 Hidden & Pre-Filled');
}
assert.doesNotMatch(
  app,
  /iframeRef\.current\.src = url/,
  '禁止隐藏预加载 iframe 去打 Dify（会污染同源 conversationIdInfo）'
);
assert.match(chatbot, /dify_embed_iframe_url_v1|readCachedDifyIframeUrl/, '必须缓存已验证的 iframe URL作为网络失败兜底');
assert.match(frame, /loading=["']eager["']/, 'iframe 必须 eager 加载，避免浏览器把后台助手当成懒加载');
assert.doesNotMatch(frame, /readCachedDifyIframeUrl/, '刷新不能用旧 URL 抢先创建空会话');
assert.doesNotMatch(chatbot, /if \(cached\) \{\s*void fetchFresh\(\);\s*return cached;/, '最新会话查询必须作用于当前 iframe');

console.log('difyAssistantOpenFrontend.test.js passed');
