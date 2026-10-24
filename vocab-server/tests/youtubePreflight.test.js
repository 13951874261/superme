/**
 * 运行：node vocab-server/tests/youtubePreflight.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  saveConfig,
  CONFIG_PATH,
  DEFAULT_COOKIES_FILE,
  getYoutubeProxy,
} = require('../services/youtubeRuntimeConfig');
const { checkCookies } = require('../services/youtubePreflight');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-preflight-'));
const origConfigPath = CONFIG_PATH;
const origSecrets = path.join(path.dirname(CONFIG_PATH), '../secrets');

// monkey patch paths via env for isolated test
process.env.YTDLP_PROXY = 'http://127.0.0.1:17897';

const sampleCookies = path.join(tmpDir, 'cookies.txt');
fs.writeFileSync(
  sampleCookies,
  '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1999999999\tLOGIN_INFO\tdemo\n',
  'utf8',
);

const cookiesCheck = checkCookies(sampleCookies);
assert.equal(cookiesCheck.ok, true, 'LOGIN_INFO cookies should pass');
assert.equal(cookiesCheck.hasLoginInfo, true);

const missing = checkCookies(path.join(tmpDir, 'missing.txt'));
assert.equal(missing.ok, false);

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.match(serverSource, /youtube-preflight/, 'server must expose youtube preflight route');
assert.match(serverSource, /youtube-config/, 'server must expose youtube config route');

console.log('youtubePreflight tests passed');
