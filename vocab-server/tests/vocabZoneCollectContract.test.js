const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relPath) => fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

const hook = read('src/hooks/useVocabCollect.ts');
const api = read('src/services/vocabAPI.ts');
const grid = read('src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx');
const buttons = read('src/components/VocabZoneCollectButtons.tsx');
const labels = read('src/utils/vocabZoneLabels.ts');
const dashboard = read('src/components/modules/english/tabs/DashboardTab.tsx');
const dictPanel = read('src/components/DictionaryPanel.tsx');
const listen = read('src/components/modules/english/tabs/ListenTab.tsx');
const wakeup = read('src/components/modules/DailyWakeupModule.tsx');
const flaw = read('src/components/modules/DailyErrorVocabularyModule.tsx');
const highlighter = read('src/components/TextHighlighter.tsx');
const immersive = read('src/components/modules/english/tabs/dashboard/ImmersiveReader.tsx');
const oralHook = read('src/components/modules/oralWarRoom/useOralTextSelection.ts');
const oralPopup = read('src/components/modules/OralWarRoomVocabPopup.tsx');
const flash = read('src/components/FlashCard.tsx');
const customCard = read('src/components/CustomCardModal.tsx');
const server = read('vocab-server/server.js');

// G001: category 必传 + 异步路径透传 + 已存在行 UPDATE category
assert.match(hook, /category: VocabCategory/, 'useVocabCollect 要求 category');
assert.doesNotMatch(hook, /category:\s*'business'/, 'hook 不再硬编码政商务区');
assert.match(hook, /scene_type: category/, '入库 scene_type 跟随用户分区');
assert.match(hook, /batchAddWordsAsync/, '超时走 batch-add-async');
assert.match(hook, /migrateOnly/, '已收录跨区走迁移');
assert.match(server, /UPDATE vocabulary SET dict_type = \?, category = \?, scene_type = \?, payload = \?/, '已存在词条更新 category 不新建');

// G002: Grid 双按钮 + 收录中另一分区仅提示
assert.match(grid, /VocabZoneCollectButtons/, 'Grid 复用分区双按钮');
assert.match(buttons, /\+ 政商务|\+ 全场景|VOCAB_ZONE_COLLECT_BTN/, '双按钮文案');
assert.match(buttons, /isOtherCollecting/, '收录中点另一分区走拦截');
assert.match(dashboard, /正在收录至\$\{VOCAB_ZONE_LABEL\[activeZone\]\}，请稍候/, 'Grid 拦截提示稍候');
assert.match(hook, /return 'blocked'/, 'hook 收录中换区返回 blocked');

// G003: 单词 Cam / 短语句型 Dify
assert.match(api, /export async function buildVocabCollectPayload/, '收录前统一拉词典');
assert.match(api, /dictType: 'en_zh_bidirectional'/, '走英汉双向 dict-query');
assert.match(api, /buildVocabPayloadFromDict/, '单词走词典面板 Cam-first 合并');
assert.match(api, /out\.cambridge_raw = d\.cambridge_raw/, '单词入库保留 cambridge_raw 供后端 merge');
assert.match(hook, /buildVocabCollectPayload/, '收录默认拉词典 payload');
assert.match(hook, /skipDictFetch/, '词典面板可跳过重复查询');
assert.match(dictPanel, /skipDictFetch: true/, '词典面板带上已有 Cam payload');
assert.match(dashboard, /migrateOnly: isMigrate/, '矩阵齐备时只迁移不重拉词典');

// G004: 其余入口去硬编码
assert.match(dictPanel, /\(\['business', 'general'\] as VocabCategory\[\]\)/, '词典面板双按钮');
assert.match(wakeup, /VOCAB_ZONE_COLLECT_BTN/, '唤醒双按钮');
assert.match(flaw, /VOCAB_ZONE_COLLECT_BTN/, '破绽双按钮');
assert.match(listen, /useVocabCollect/, '精听走统一收录');
assert.match(listen, /VocabZoneCollectButtons/, '精听复用分区双按钮');
assert.match(listen, /migrateOnly/, '精听跨区只迁移');
assert.match(highlighter, /VocabZoneCollectButtons/, '划线复用分区双按钮');
assert.match(highlighter, /migrateOnly/, '划线跨区只迁移');
assert.match(immersive, /VocabZoneCollectButtons/, '沉浸阅读复用分区双按钮');
assert.match(immersive, /migrateOnly/, '沉浸阅读跨区只迁移');
assert.match(hook, /collectingRef/, '收录中换区用 ref 同步锁');
assert.match(hook, /queuedRef/, '后台处理中换区同样拦截');
assert.match(hook, /lookupVocabWords/, '收录前查已有词条以推断迁移');
assert.match(hook, /hydrateTexts/, '入口可按文本回填已收录分区');
assert.match(hook, /stripThinHoverSeed/, '不把悬浮薄缓存当最终入库结果');
assert.match(listen, /hydrateTexts/, '精听回填已收录分区');
assert.match(highlighter, /hydrateTexts/, '划线回填已收录分区');
assert.match(immersive, /hydrateTexts/, '沉浸阅读回填已收录分区');
assert.match(oralHook, /hydrateTexts/, '口语回填已收录分区');
assert.match(oralHook, /notifyBlocked/, '口语收录中提示稍候');
assert.match(oralPopup, /onBlockedWhileCollecting/, '口语弹层拦截另一分区');
assert.match(oralPopup, /queuedZone/, '口语弹层展示后台处理中');
assert.match(buttons, /lockZone = collectingZone \?\? queuedZone/, '双按钮 queued 与 collecting 同级加锁');
assert.match(labels, /export function stripThinHoverSeed/, '薄缓存剥离可单测');
assert.match(oralHook, /category: VocabCategory/, '口语划词由用户选分区');
assert.doesNotMatch(oralHook, /getVocabZoneFromScene/, '口语不再按场景自动分区');
assert.match(oralPopup, /onCollect/, '口语弹层双分区');
assert.doesNotMatch(flash, /category:\s*'general'/, '闪卡不再静默写入全场景区');
assert.match(customCard, /setCategory/, '制卡保留分区 Segment');

// AC-5 回归锚点
assert.match(hook, /VOCAB_COLLECT_RACE_MS = 3000/, '保留 3 秒竞速');
assert.match(
  hook,
  /const action = \(async \(\) => \{[\s\S]*dictFetchPromise[\s\S]*addWordEnriched/,
  '词典拉取纳入 3 秒竞速，超时仍转任务中心',
);
assert.match(hook, /dictFetchPromise/, 'handoff 复用 in-flight dict-query');
assert.match(hook, /resolveHandoffPayload/, '超时 handoff 等待词典种子后再入队');
assert.match(labels, /classifyCollectKind/, '词/短语/句型分类可复用');

console.log('✅ vocabZoneCollectContract.test.js 通过');
