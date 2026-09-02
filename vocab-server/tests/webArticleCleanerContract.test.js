const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const route = server.slice(server.indexOf("app.post('/api/materials/fetch-url'"), server.indexOf("app.post('/api/materials/upload-chunk'"));
assert.match(route, /fetchAndExtractWebArticle\(url\)/);
assert.match(route, /fetchUrlContent\(url\)/);
assert.match(route, /extractArticleFromMarkdown\(fallback\.markdown, fallback\.title\)/);
assert.match(route, /catch \(htmlError\)/);
assert.match(route, /res\.json\(\{ title: result\.title, markdown: result\.markdown \}\)/);
assert.doesNotMatch(route, /cleanWebArticleMarkdown/);
console.log('web article extractor contract passed');
