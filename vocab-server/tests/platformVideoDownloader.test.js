/**
 * 平台视频链接识别契约
 * 运行：node vocab-server/tests/platformVideoDownloader.test.js
 */
const assert = require('assert');
const {
  isPlatformVideoUrl,
  getPlatformLabel,
  matchPlatformRule,
} = require('../services/platformVideoDownloader');

const youtubeCases = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/shorts/abcdefghijk',
];

const bilibiliCases = [
  'https://www.bilibili.com/video/BV1xx411c7mD',
  'https://m.bilibili.com/video/BV1xx411c7mD',
  'https://b23.tv/abc123',
];

const nonPlatformCases = [
  'https://example.com/movie.mp4',
  'https://cdn.example.com/video/test.mp4',
  'ftp://youtube.com/watch?v=abc',
  '',
];

for (const url of youtubeCases) {
  assert.ok(isPlatformVideoUrl(url), `应识别为平台视频: ${url}`);
  assert.equal(getPlatformLabel(url), 'YouTube', `YouTube 标签错误: ${url}`);
  assert.equal(matchPlatformRule(url)?.id, 'youtube', `YouTube 规则错误: ${url}`);
}

for (const url of bilibiliCases) {
  assert.ok(isPlatformVideoUrl(url), `应识别为平台视频: ${url}`);
  assert.equal(getPlatformLabel(url), '哔哩哔哩', `B站标签错误: ${url}`);
  assert.equal(matchPlatformRule(url)?.id, 'bilibili', `B站规则错误: ${url}`);
}

for (const url of nonPlatformCases) {
  assert.ok(!isPlatformVideoUrl(url), `不应识别为平台视频: ${url || '(empty)'}`);
}

console.log('platformVideoDownloader tests passed');
