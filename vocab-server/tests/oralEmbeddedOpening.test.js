const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const sessionPath = path.join(root, 'src/components/modules/oralWarRoom/useOralWarRoomSession.ts');
const dialoguePath = path.join(root, 'src/components/modules/oralWarRoom/useOralDialogue.ts');
const chatPath = path.join(root, 'src/components/modules/OralWarRoomChat.tsx');
const oralPath = path.join(root, 'src/components/modules/OralWarRoom.tsx');
const difyPath = path.join(root, 'src/services/difyAPI.ts');

function read(p) {
  assert.ok(fs.existsSync(p), `缺少文件: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function testEmbeddedAlsoAutoOpens() {
  const session = read(sessionPath);
  const initStart = session.indexOf('sceneInitRef.current === activeSceneId');
  assert.ok(initStart >= 0, '找不到开场初始化 effect');
  const window = session.slice(Math.max(0, initStart - 180), initStart + 280);
  assert.doesNotMatch(
    window,
    /if \(embedded\) return/,
    '英语嵌套页签不得跳过自动开场',
  );
  assert.match(window, /initiateSceneDialogue\(activeScene\)/, '挂载/切场景必须自动开场');
}

function testOpeningTimeoutAndRetry() {
  const dialogue = read(dialoguePath);
  assert.match(dialogue, /timeoutMs:\s*8_?000|8000/, '开场请求必须带约 8 秒超时');
  const chat = read(chatPath);
  assert.match(chat, /重新开场/, '必须提供重新开场按钮');
  assert.match(chat, /onRetryOpening/, 'Chat 必须接收重新开场回调');
  const oral = read(oralPath);
  assert.match(oral, /onRetryOpening=\{session\.(handleRetryOpening|initiateSceneDialogue)\}/, 'OralWarRoom 必须把重新开场接到 Chat');
  const dify = read(difyPath);
  const proxyStart = dify.indexOf('async function proxyOralChatMessage');
  const proxy = dify.slice(proxyStart, proxyStart + 900);
  assert.match(proxy, /timeoutMs/, '口语代理必须支持超时中断');
  assert.match(proxy, /fetchWithTimeout/, '超时必须复用已有 fetchWithTimeout，禁止另写一套');
}

testEmbeddedAlsoAutoOpens();
console.log('PASS 嵌套页签也会自动开场');
testOpeningTimeoutAndRetry();
console.log('PASS 开场超时 + 重新开场');
console.log('\noralEmbeddedOpening.test.js 全部通过');
