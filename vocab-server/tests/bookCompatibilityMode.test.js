const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production compatibility mode disables book startup and routes without workflow configuration', () => {
  const server = read('vocab-server/server.js');
  assert.match(server, /const bookFeatureEnabled = process\.env\.BOOK_FEATURE_ENABLED === 'true'/);
  assert.match(server, /if \(bookFeatureEnabled\) assertProductionBookWorkflows\(\)/);
  assert.match(server, /app\.use\('\/api\/books', \(req, res, next\) => bookFeatureEnabled \? next\(\) : res\.status\(503\)/);
  assert.ok(server.indexOf("app.use('/api/books', (req, res, next)") < server.indexOf("app.use('/api', requireAuth"), 'disabled book route must run before authentication');
  assert.match(server, /BOOK_FEATURE_DISABLED/);
  assert.match(server, /if \(bookFeatureEnabled\) \{[\s\S]*bookJobRunner\.start/);
});

test('frontend and deploy gate use the same explicit opt-in compatibility contract', () => {
  const listen = read('src/components/modules/ListenModule.tsx');
  const speak = read('src/components/modules/SpeakModule.tsx');
  const taskCenter = read('src/components/GlobalTaskCenter.tsx');
  const deploy = read('deploy-smart.ps1');
  assert.match(listen, /import\.meta\.env\.VITE_BOOK_FEATURE_ENABLED === 'true'/);
  assert.match(speak, /import\.meta\.env\.VITE_BOOK_FEATURE_ENABLED === 'true'/);
  assert.match(taskCenter, /import\.meta\.env\.VITE_BOOK_FEATURE_ENABLED === 'true'/);
  assert.match(taskCenter, /if \(!bookFeatureEnabled\) return/);
  assert.match(deploy, /\$bookFeatureEnabled = \$env:BOOK_FEATURE_ENABLED -eq 'true'/);
  assert.match(deploy, /\$bookDeployRequested = \$bookFeatureEnabled -and/);
});
