const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const css = read('src/index.css');
const profile = read('src/components/ProfileEditModal.tsx');
const flashCard = read('src/components/FlashCard.tsx');
const tactics = read('src/components/modules/GameTheory/TacticsPanel.tsx');
const vault = read('src/components/KnowledgeVault/KnowledgeVaultDrawer.tsx');
const listen = read('src/components/modules/english/tabs/ListenTab.tsx');

for (const token of ['--overlay-z-modal', '--overlay-z-drawer', '--overlay-z-lightbox', '--overlay-backdrop', '--overlay-radius', '--overlay-shadow']) {
  assert.match(css, new RegExp(token), `共享 overlay token 缺失: ${token}`);
}
assert.match(css, /\.overlay-backdrop\s*\{/);
assert.match(css, /\.overlay-surface\s*\{/);
assert.match(css, /\.overlay-enter\s*\{/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.overlay-enter/);

for (const [name, source] of [['ProfileEditModal', profile], ['FlashCard', flashCard], ['TacticsPanel', tactics]]) {
  assert.match(source, /overlay-backdrop/, `${name} 必须采用共享遮罩`);
  assert.match(source, /overlay-surface/, `${name} 必须采用共享 surface`);
  assert.match(source, /role="dialog"/, `${name} 必须提供 dialog 语义`);
  assert.match(source, /aria-modal="true"/, `${name} 必须声明 aria-modal`);
}
assert.match(vault, /overlay-drawer/, 'KnowledgeVault drawer 必须采用共享 drawer 层级与阴影');
assert.match(listen, /overlay-fullscreen/, '全屏原文必须采用共享全屏层级');
console.log('overlaySurfaceContract tests passed');
