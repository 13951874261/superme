const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.match(src, /\/api\/game-theory\/tactics\/export-background/, 'tactics export-background route');
assert.match(src, /\/api\/knowledge-vault\/export-background/, 'vault export-background route');
assert.match(src, /tactics_export/, 'tactics_export task type');
assert.match(src, /vault_export/, 'vault_export task type');
assert.match(src, /encoding:\s*'base64'/, 'docx result uses base64 encoding');
console.log('exportBackgroundContract.test.js passed');
