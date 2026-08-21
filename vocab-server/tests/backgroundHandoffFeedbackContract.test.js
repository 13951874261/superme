const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relPath) => fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

const handoff = read('src/utils/backgroundHandoff.ts');
const near = read('src/components/NearHandoffNotice.tsx');
const header = read('src/components/Header.tsx');
const app = read('src/App.tsx');
const hook = read('src/hooks/useVocabCollect.ts');
const grid = read('src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx');
const dashboard = read('src/components/modules/english/tabs/DashboardTab.tsx');
const arsenal = read('src/components/modules/english/tabs/dashboard/ArsenalPanel.tsx');

assert.match(handoff, /notifyBackgroundHandoff/, '共享 handoff API');
assert.match(handoff, /有锚点时默认不弹同文案 Toast|wantToast.*!hasAnchor|!hasAnchor/, '有锚点默认不 Toast');
assert.match(hook, /if \(!anchor\) notify/, '有锚点时不再二次 notify 同文案');
assert.match(dashboard, /if \(!handoffAnchor\) showNotice/, '长文有锚点时不二次 showNotice');

assert.match(near, /showNearHandoff/, '就近浮层 API');
assert.match(near, /NearHandoffHost/, '就近 Host');
assert.match(near, /useGSAP/, '就近浮层使用 useGSAP');
assert.match(app, /NearHandoffHost/, 'App 挂载 NearHandoffHost');

assert.match(header, /TASK_CENTER_PULSE_EVENT/, 'Header 监听脉冲');
assert.match(header, /taskCenterBtnRef/, '任务中心按钮 ref');
assert.match(header, /useGSAP/, 'Header 脉冲用 useGSAP');

assert.match(hook, /isQueued/, 'hook 导出 isQueued');
assert.match(hook, /notifyBackgroundHandoff/, '超时转后台走统一 handoff');
assert.match(hook, /anchor/, '支持就近锚点');

assert.match(grid, /VOCAB_COLLECT_LABEL/, '词表使用收录文案常量');
assert.match(grid, /isQueued/, '词表绑定 queued 态');
assert.match(grid, /后台处理中|VOCAB_COLLECT_LABEL\.queued/, '词表展示后台处理中');

assert.match(dashboard, /notifyBackgroundHandoff/, '长文超时走统一 handoff');
assert.match(dashboard, /isBackgroundGenerating/, '长文后台态');
assert.match(arsenal, /后台处理中/, '弹药库按钮后台文案');

assert.match(read('src/components/modules/DailyWakeupModule.tsx'), /isQueued/, '唤醒收录 queued 态');
assert.match(read('src/components/modules/DailyErrorVocabularyModule.tsx'), /后台处理中/, '破绽收录后台文案');
assert.match(read('src/components/modules/english/tabs/dashboard/ThemeGateway.tsx'), /notifyBackgroundHandoff/, '场景清理 handoff');
assert.match(read('src/components/modules/english/tabs/ListenTab.tsx'), /notifyBackgroundHandoff/, '听力 backfill handoff');
assert.match(read('src/components/VocabExportControl.tsx'), /notifyBackgroundHandoff/, '导出 handoff');
assert.match(read('src/components/DictionaryPanel.tsx'), /useVocabCollect/, '词典面板走统一收录');
assert.match(read('src/components/DictionaryPanel.tsx'), /VOCAB_COLLECT_LABEL|后台处理中/, '词典面板后台处理中态');
assert.doesNotMatch(
  read('src/components/DictionaryPanel.tsx').split('export default function DictionaryPanel')[1] || '',
  /addWord\(/,
  '词典面板默认导出不再直接 addWord'
);

console.log('✅ backgroundHandoffFeedbackContract.test.js 通过');
