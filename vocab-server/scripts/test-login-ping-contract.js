const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('login-ping starts catch-up without awaiting and handles rejection', () => {
  const route = extract(
    read('vocab-server/server.js'),
    "app.post('/api/user/login-ping'",
    "app.get('/api/daily-pack/today'",
  );

  assert.match(route, /dailyListenPreGenerateService\.scheduleUserDailyCatchup\(db,\s*\{\s*userId,\s*theme\s*\}\)/);
  assert.doesNotMatch(route, /await\s+dailyListenPreGenerateService\.scheduleUserDailyCatchup/);
  assert.match(
    route,
    /void\s+dailyListenPreGenerateService\.scheduleUserDailyCatchup\([\s\S]*?\)\.catch\(\(error\)\s*=>\s*\{[\s\S]*?console\.(?:warn|error)/,
  );
  assert.match(route, /res\.json\(\{\s*success:\s*true,\s*catchupScheduled:\s*true,\s*\.\.\.result\s*\}\)/);
});

test('login-ping keeps both database writes inside the 500 boundary', () => {
  const route = extract(
    read('vocab-server/server.js'),
    "app.post('/api/user/login-ping'",
    "app.get('/api/daily-pack/today'",
  );

  assert.match(route, /recordUserLogin\(db,\s*userId\)[\s\S]*upsertUserTheme\(db,\s*userId,\s*theme\)/);
  assert.doesNotMatch(route, /upsertUserTheme fail/);
  assert.match(route, /catch\s*\(e\)\s*\{\s*res\.status\(500\)/);
});

test('frontend login ping rejects non-2xx and unsuccessful JSON responses', () => {
  const helper = read('src/utils/profileHelper.ts');
  const loginPing = extract(
    helper,
    'export async function recordUserLoginPing',
    'export async function initializeUserSession',
  );

  assert.match(loginPing, /const res = await fetch\('\/api\/user\/login-ping'/);
  assert.match(loginPing, /const json = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(loginPing, /!res\.ok\s*\|\|\s*!json\?\.success/);
  assert.match(loginPing, /userId/);
  assert.match(loginPing, /HTTP \$\{res\.status\}/);
  assert.match(loginPing, /throw new Error/);
});

test('session initialization pings before loading the profile', () => {
  const helper = read('src/utils/profileHelper.ts');
  const initialize = extract(
    helper,
    'export async function initializeUserSession',
    '\n}',
  );

  const pingIndex = initialize.indexOf('await recordUserLoginPing(userId)');
  const profileIndex = initialize.indexOf('await loadUserProfileFromServer(userId)');
  assert.ok(pingIndex >= 0, 'initializeUserSession must await login ping');
  assert.ok(profileIndex > pingIndex, 'profile load must happen after login ping');
});

test('authenticated fallback uses reliable ping and logs failures', () => {
  const app = read('src/App.tsx');

  assert.match(app, /import\s*\{[\s\S]*recordUserLoginPing[\s\S]*\}\s*from '\.\/utils\/profileHelper'/);
  assert.match(
    app,
    /void recordUserLoginPing\(userId\)\.catch\(\(error\)\s*=>\s*\{[\s\S]*?console\.warn/,
  );
});
