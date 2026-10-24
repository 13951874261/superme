const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
const servicePath = path.join(__dirname, '../services/learningUiService.js');
const server = fs.readFileSync(serverPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

assert.match(service, /function persistLearningUi/);
assert.match(service, /'\{\}', '\{\}', 0, \?\)/);
assert.match(service, /must not bump updated_at/);
assert.doesNotMatch(service, /upsertUserMemoryRow/);

assert.match(server, /learningUiService/);
assert.match(server, /learning_ui_json/);
assert.match(server, /app\.put\('\/api\/user\/learning-ui'/);
assert.match(server, /app\.get\('\/api\/user\/learning-ui\/:userId'/);

// profile GET 显式列，不把 SELECT * 展开进 data
const profileGet = server.slice(
  server.indexOf("app.get('/api/user/profile/:userId'"),
  server.indexOf("app.get('/api/user/learning-ui/:userId'"),
);
assert.match(profileGet, /learning_ui_json/);
assert.match(profileGet, /learning_ui:/);
assert.doesNotMatch(profileGet, /\.\.\.row/);

// profile SAVE 仍只走 upsert 画像列（契约：不写 learning_ui）
const profileSave = server.slice(
  server.indexOf("app.post('/api/user/profile/save'"),
  server.indexOf("app.post('/api/user/profile/compress'"),
);
assert.doesNotMatch(profileSave, /learning_ui/);

console.log('PASS learningUiContract');
