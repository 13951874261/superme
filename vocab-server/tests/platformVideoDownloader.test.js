/**
 * 平台视频链接识别契约
 * 运行：node vocab-server/tests/platformVideoDownloader.test.js
 */
const assert = require('assert');
const {
  isPlatformVideoUrl,
  getPlatformLabel,
  matchPlatformRule,
  extractBvid,
  extractYoutubeId,
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

assert.equal(extractBvid('https://www.bilibili.com/video/BV1oVh56UEXu/?spm_id_from=333.337.search-card.all.click'), 'BV1oVh56UEXu');
assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=YoBc3zII7lg'), 'YoBc3zII7lg');
assert.equal(extractYoutubeId('https://youtu.be/YoBc3zII7lg'), 'YoBc3zII7lg');

console.log('platformVideoDownloader tests passed');
