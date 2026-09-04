const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const host = read('src/components/overlays/AnchoredOverlayHost.tsx');
const css = read('src/index.css');
const rightPanel = read('src/components/RightPanel.tsx');

assert.match(host, /requestAnimationFrame/, 'scroll/resize 定位必须按帧合并');
assert.match(host, /aria-modal="true"/);
assert.match(host, /event\.key !== 'Tab'/, '确认框必须实现 Tab 焦点循环');
assert.match(host, /--overlay-z-confirm/);
assert.match(host, /--overlay-z-popover/);
assert.doesNotMatch(host, /z-\[11000\]|z-\[3100\]|z-\[3090\]/);
assert.match(css, /--overlay-z-popover:/);
assert.match(css, /--overlay-z-confirm:/);
assert.doesNotMatch(rightPanel, /z-\[10050\]/);
assert.match(rightPanel, /aria-expanded=\{showProfileMenu\}/);
assert.match(rightPanel, /aria-haspopup="dialog"/);
assert.doesNotMatch(rightPanel, /role="menu"/);
console.log('anchoredOverlayContract tests passed');
