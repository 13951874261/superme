/**
 * 材料提纯手动收录：停自动入库 + 与长文同样展示生词/短语/句型
 * 运行：node vocab-server/tests/materialManualCollectContract.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const vtSrc = read('vocab-server/services/videoTranscriber.js');
const serverSrc = read('vocab-server/server.js');
const taskCtx = read('src/components/TaskContext.tsx');
const intel = read('src/components/modules/english/tabs/dashboard/IntelBriefing.tsx');
const grid = read('src/components/modules/english/tabs/dashboard/VocabularyGrid.tsx');
const dash = read('src/components/modules/english/tabs/DashboardTab.tsx');

// 视频提纯不得再 INSERT 生词本；结果必须带三类候选
assert.doesNotMatch(vtSrc, /正在查重新增至生词本/);
assert.doesNotMatch(vtSrc, /共新增 \$\{addedCount\} 个词汇到生词本/);
assert.doesNotMatch(vtSrc, /INSERT INTO vocabulary/);
assert.match(vtSrc, /phrases/);
assert.match(vtSrc, /sentences/);
assert.match(vtSrc, /请逐条点「\+ 收录」|请手动收录/);

// 材料整理流水线提纯后不得排重写入生词本，但仍返回三类
assert.doesNotMatch(serverSrc, /正在排重写入 SQLite 生词本/);
assert.match(serverSrc, /wordsToReturn/);
assert.match(serverSrc, /phrasesToReturn/);
assert.match(serverSrc, /sentencesToReturn/);
assert.match(serverSrc, /请逐条点「\+ 收录」|不写入生词本/);

// 材料完成写入材料专用缓存，不得覆盖长文 key
assert.match(taskCtx, /super_agent_material_article/);
assert.match(taskCtx, /super_agent_material_words/);
assert.match(taskCtx, /super_agent_material_phrases/);
assert.match(taskCtx, /super_agent_material_sentences/);
assert.match(taskCtx, /isMaterialLike/);
assert.match(taskCtx, /material-data-refreshed/);
assert.doesNotMatch(taskCtx, /import-virtual-material/);

// 今日学习材料：长文 / 上传材料标签；材料侧一眼三块
assert.match(intel, /今日长文/);
assert.match(intel, /上传材料/);
assert.match(intel, /VocabularyGrid/);
assert.match(intel, /未抽出词句/);
assert.match(grid, /已整理出的商战生词/);
assert.match(grid, /已整理出的高频短语/);
assert.match(grid, /已整理出的高频句型/);

// Dashboard 材料状态与长文分列；上传成功写入材料缓存
assert.match(dash, /materialArticle/);
assert.match(dash, /super_agent_material_article/);
assert.doesNotMatch(dash, /setGeneratedArticle\(data\.article\)/);

const uploader = read('src/components/MaterialUploader.tsx');
const taskCenter = read('src/components/GlobalTaskCenter.tsx');
assert.match(uploader, /notifyBackgroundHandoff/);
assert.match(uploader, /已进入后台任务中心/);
assert.match(taskCenter, /查看材料/);
assert.match(taskCenter, /open-uploaded-material/);
assert.match(dash, /open-uploaded-material/);

console.log('materialManualCollectContract tests passed');
