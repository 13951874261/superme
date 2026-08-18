/**
 * XF-FEED-01 / XF-FEED-02 契约：refine 路由 + material 落导图 + compact 开放视频 Tab
 * 运行：node --test vocab-server/tests/vaultFeedContract.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const drawerSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'KnowledgeVault', 'KnowledgeVaultDrawer.tsx'),
  'utf8'
);
const uploaderSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'MaterialUploader.tsx'),
  'utf8'
);

describe('XF-FEED vault feed contract', () => {
  it('server 含 refine 路由与 afterKnowledgeInjected', () => {
    assert.match(serverSrc, /\/api\/knowledge-vault\/notes\/:id\/refine/);
    assert.match(serverSrc, /afterKnowledgeInjected/);
    assert.match(serverSrc, /vault_refine/);
    assert.match(serverSrc, /mindmap:\s*mindmapAndTheory\.mindmap/);
  });

  it('抽屉嵌入 MaterialUploader compact', () => {
    assert.match(drawerSrc, /MaterialUploader/);
    assert.match(drawerSrc, /compact/);
    assert.match(drawerSrc, /重试加深|onRetryRefine/);
  });

  it('XF-FEED-02: MaterialUploader compact 开放视频 Tab，隐藏网页提取 Tab', () => {
    // 网页提取保持 !compact 条件判断
    assert.ok(uploaderSrc.includes("!compact &&"));
    assert.ok(uploaderSrc.includes("setActiveTab('url')"));
    // 视频字幕 Tab 在 compact 模式下可访问，不再被 !compact 条件包裹
    assert.ok(uploaderSrc.includes("setActiveTab('video')"));
    assert.match(uploaderSrc, /setActiveTab\('url'\)[\s\S]*?<\/button>\s*\)\}\s*<button[\s\S]*?setActiveTab\('video'\)/);
  });
});
