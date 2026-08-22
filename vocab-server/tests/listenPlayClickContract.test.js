const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tabPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenTab.tsx');
const tab = fs.readFileSync(tabPath, 'utf8');

const loadStart = tab.indexOf('const loadFromPregenerateOrRealtime');
assert.ok(loadStart >= 0, '找不到 loadFromPregenerateOrRealtime');
const loadEnd = tab.indexOf('useEffect(() => {\n    if (!curTtsTaskId)', loadStart);
const loadFn = tab.slice(loadStart, loadEnd > loadStart ? loadEnd : loadStart + 2500);
assert.match(loadFn, /setIsPlaying\(false\)/, '切条件必须立刻把 isPlaying 置 false');
assert.match(loadFn, /audioRef\.current\?\.pause\(\)/, '切条件必须立刻 pause 当前音频');

const playerStart = tab.indexOf('bg-white/5 p-3 sm:p-4 rounded-2xl mb-6');
assert.ok(playerStart >= 0, '找不到播放器容器');
const playerEnd = tab.indexOf('Target Transcript', playerStart);
const player = tab.slice(playerStart, playerEnd > playerStart ? playerEnd : playerStart + 8000);

assert.doesNotMatch(
  player,
  /isListenMaterialLoading \?/,
  '切条件加载中不得用 spinner 卸掉播放按钮',
);
assert.match(player, /preload="auto"/, 'audio 必须 preload=auto，否则 35m 首点 play 会空等');
assert.match(player, /canplay/, 'readyState 不够时必须等 canplay 再 play');
assert.doesNotMatch(player, /speakEnglish/, '播放失败不得改朗读整篇原文');
assert.match(player, /Math\.floor\(e\.currentTarget\.currentTime\)/, 'onTimeUpdate 必须按整秒更新，禁止每帧 setState');

console.log('✅ listenPlayClickContract.test.js 通过');
