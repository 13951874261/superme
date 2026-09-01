const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const route = server.slice(server.indexOf("app.post('/api/materials/fetch-url'"), server.indexOf("app.post('/api/materials/upload-chunk'"));
assert.match(route, /cleanWebArticleMarkdown/);
assert.match(route, /fetchUrlContent\(url\)/);
assert.match(route, /rawLength/);
assert.match(route, /markdown:\s*cleaned/);
console.log('web article cleaner contract passed');
