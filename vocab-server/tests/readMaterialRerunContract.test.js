const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

assert.match(server, /mode === 'all_current'[\s\S]*?readMaterialCacheService\.generateAllForUser/);
assert.match(server, /fs\.module === 'read_material'[\s\S]*?readMaterialCacheService\.generateAllForUser/);
assert.match(server, /read_material'[\s\S]*?inputs: \{ theme, packDate:/);
console.log('readMaterialRerunContract.test.js passed');
