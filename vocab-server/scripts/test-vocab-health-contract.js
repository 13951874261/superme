const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const serverSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'server.js'),
  'utf8',
);

function extractHealthRoute() {
  const start = serverSrc.indexOf("app.get('/api/vocab/health'");
  assert.notEqual(start, -1, 'missing /api/vocab/health route');
  const end = serverSrc.indexOf('});', start);
  assert.notEqual(end, -1, 'health route is not closed');
  return serverSrc.slice(start, end + 3);
}

test('vocab health route exists and does not touch the database', () => {
  const route = extractHealthRoute();
  assert.match(route, /res\.json\(/);
  assert.match(route, /success:\s*true/);
  assert.doesNotMatch(route, /\bdb\./);
  assert.doesNotMatch(route, /prepare\(/);
});
