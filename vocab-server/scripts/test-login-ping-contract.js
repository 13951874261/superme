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

test('login-ping records login without scheduling catch-up', () => {
  const route = extract(
    read('vocab-server/server.js'),
    "app.post('/api/user/login-ping'",
    "app.get('/api/system/date'",
  );

  assert.doesNotMatch(route, /scheduleUserDailyCatchup/);
  assert.doesNotMatch(route, /upsertUserTheme/);
  assert.match(route, /recordUserLogin\(db,\s*userId\)/);
  assert.match(route, /res\.json\(\{\s*success:\s*true,\s*catchupScheduled:\s*false,\s*\.\.\.result\s*\}\)/);
});

test('login-ping keeps the login write inside the 500 boundary and does not rewrite theme', () => {
  const route = extract(
    read('vocab-server/server.js'),
    "app.post('/api/user/login-ping'",
    "app.get('/api/system/date'",
  );

  assert.match(route, /recordUserLogin\(db,\s*userId\)/);
  assert.doesNotMatch(route, /upsertUserTheme/);
  assert.match(route, /catch\s*\(e\)\s*\{\s*res\.status\(500\)/);
});

test('frontend login ping rejects non-2xx and unsuccessful JSON responses', () => {
  const helper = read('src/utils/profileHelper.ts');
  const loginPing = extract(
    helper,
    'export async function recordUserLoginPing',
    'export async function initializeUserSession',
  );

  assert.match(loginPing, /\/api\/user\/login-ping/);
  assert.match(loginPing, /fetchWithTimeout|AbortController/);
  assert.match(loginPing, /SESSION_INIT_TIMEOUT_MS|timeoutMs:\s*8000|abort\(\),\s*8000/);
  assert.match(loginPing, /const json = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(loginPing, /!res\.ok\s*\|\|\s*!json\?\.success/);
  assert.match(loginPing, /userId/);
  assert.match(loginPing, /HTTP \$\{res\.status\}/);
  assert.match(loginPing, /throw new Error/);
});

test('session init and profile fetch share an 8s timeout and do not block unlock', () => {
  const helper = read('src/utils/profileHelper.ts');
  assert.match(helper, /SESSION_INIT_TIMEOUT_MS\s*=\s*8000/);
  assert.match(helper, /function fetchWithTimeout/);

  const profileLoad = extract(
    helper,
    'export async function loadUserProfileFromServer',
    'export function saveUserErrorLedger',
  );
  assert.match(profileLoad, /fetchWithTimeout/);

  const initialize = extract(
    helper,
    'export async function initializeUserSession',
    '\n}',
  );
  assert.match(initialize, /recordUserLoginPing\(userId\)/);
  assert.match(initialize, /loadUserProfileFromServer\(userId\)/);
  assert.match(initialize, /Promise\.allSettled/);
  assert.match(initialize, /return userId/);
});

test('authenticated fallback uses reliable ping and logs failures', () => {
  const app = read('src/App.tsx');

  assert.match(app, /import\s*\{[\s\S]*recordUserLoginPing[\s\S]*\}\s*from '\.\/utils\/profileHelper'/);
  assert.match(
    app,
    /void recordUserLoginPing\(userId\)\.catch\(\(error\)\s*=>\s*\{[\s\S]*?console\.warn/,
  );
});

test('EnglishProvider and TaskProvider mount only after login', () => {
  const app = read('src/App.tsx');
  const start = app.indexOf('export default function App()');
  assert.notEqual(start, -1, 'missing App()');
  const body = app.slice(start);
  assert.match(
    body,
    /!isAuthenticated \? \([\s\S]*<LoginPage[\s\S]*\) : \([\s\S]*<EnglishProvider[\s\S]*<TaskProvider[\s\S]*<AppContent/,
  );
  const providerIdx = body.indexOf('<EnglishProvider');
  const loginIdx = body.indexOf('<LoginPage');
  assert.ok(loginIdx >= 0 && providerIdx > loginIdx, 'EnglishProvider must not wrap the login page');
});
