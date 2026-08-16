/**
 * XF-FEED-01 契约：refine 路由 + material 落导图关键字
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
});
