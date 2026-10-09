const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const chatbot = fs.readFileSync(path.join(root, 'src/utils/difyChatbot.ts'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/RightPanel.tsx'), 'utf8');
const frame = fs.readFileSync(path.join(root, 'src/components/DifyAssistantFrame.tsx'), 'utf8');
assert.match(chatbot, /const accountId = getAppUserId\(\)/, 'app_user_id 必须当前登录账号');
assert.match(chatbot, /overrides\.memory_pack \|\| getUserWeaknessProfile\(\)/, '留空默认当前短板画像');
assert.match(chatbot, /parsed\?\.ownerUserId !== getAppUserId\(\)/, '手填记忆必须校验所属账号');
assert.match(chatbot, /ownerUserId: getAppUserId\(\)/, '保存记忆必须记录当前账号');
assert.match(frame, /min-h-\[700px\]/, 'iframe 最小高度必须 700px');
assert.doesNotMatch(panel, /app_user_id: embedAccount/, '不可手填覆盖登录账号');
assert.match(panel, /留空时使用.*专属复盘与弱点扫描/, '必须说明默认记忆来源');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const urlBuilder = chatbot.match(/export async function buildMinimalIframeUrl\([\s\S]*?\n\}/)[0]
  .replace('export async function', 'async function')
  .replace(/userId: string,/, 'userId,')
  .replace(/conversationId\?: string \| null,/, 'conversationId,')
  .replace(/sessionUserId\?: string \| null,/, 'sessionUserId,')
  .replace('): Promise<string>', ')');
const sandbox = {
  URLSearchParams,
  DIFY_EMBED_BASE_URL: 'https://dify.example',
  DIFY_EMBED_TOKEN: 'app',
  getAppUserId: () => 'learner@example.com',
  getDifyEmbedInputOverrides: () => ({ app_user_id: 'wrong-account', memory_pack: '' }),
  getUserWeaknessProfile: () => '目标：提高沟通能力；弱点：表达不清晰',
  compressAndEncodeBase64: async value => require('node:zlib').gzipSync(value).toString('base64'),
};
vm.createContext(sandbox);
vm.runInContext(urlBuilder, sandbox);
(async () => {
  const decode = value => gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
  let params = new URL(await sandbox.buildMinimalIframeUrl('old-user', 'conversation', 'session')).searchParams;
  assert.equal(decode(params.get('app_user_id')), 'learner@example.com');
  assert.equal(decode(params.get('memory_pack')), sandbox.getUserWeaknessProfile());
  assert.equal(decode(params.get('sys.conversation_id')), 'conversation');
  assert.equal(decode(params.get('sys.user_id')), 'session');
  sandbox.getDifyEmbedInputOverrides = () => ({ memory_pack: '自定义说明' });
  params = new URL(await sandbox.buildMinimalIframeUrl('old-user')).searchParams;
  assert.equal(decode(params.get('memory_pack')), '自定义说明');
  sandbox.getDifyEmbedInputOverrides = () => ({});
  sandbox.getUserWeaknessProfile = () => '';
  params = new URL(await sandbox.buildMinimalIframeUrl('old-user')).searchParams;
  assert.equal(decode(params.get('memory_pack')), '');
  console.log('difyEmbedInputs.test.js passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
