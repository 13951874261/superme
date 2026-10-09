const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../src/services/difyAPI.ts'), 'utf8');
const start = source.indexOf('export async function audioToText');
const end = source.indexOf('\n}', start) + 2;
assert.ok(start >= 0, 'audioToText function must exist');
const segment = source.slice(start, end);
assert.match(segment, /fetch\(['"]\/api\/audio\/transcriptions['"]/);
assert.doesNotMatch(segment, /VITE_DIFY_STT_API_KEY/);
assert.doesNotMatch(segment, /Authorization/);
assert.match(segment, /formData\.append\(['"]file['"]/);
assert.match(segment, /formData\.append\(['"]user['"]/);
console.log('audioToText proxy contract tests passed');