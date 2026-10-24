import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const api = fs.readFileSync(path.join(process.cwd(), 'src/services/dailyPackAPI.ts'), 'utf8');
const moduleSource = fs.readFileSync(path.join(process.cwd(), 'src/components/modules/ReadModule.tsx'), 'utf8');
assert.match(api, /fetchPregeneratedReadMaterial/);
assert.match(moduleSource, /fetchPregeneratedReadMaterial/);
assert.match(moduleSource, /generateReadMaterial/);
console.log('readMaterialCacheAPI.contract.test.ts passed');
