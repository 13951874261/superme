/**
 * 视频转写 STT：本机 Whisper 5 分钟切片契约
 * 运行：node vocab-server/tests/videoWhisperSliceContract.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '../services/audioTranscriptionService.js');
const vtPath = path.join(__dirname, '../services/videoTranscriber.js');

const serviceSrc = fs.readFileSync(servicePath, 'utf8');
const vtSrc = fs.readFileSync(vtPath, 'utf8');

assert.match(serviceSrc, /const SLICE_SECONDS = 300/);
assert.match(serviceSrc, /async function transcribeAudioFileSliced/);
assert.match(serviceSrc, /转写缺口/);
assert.match(serviceSrc, /MAX_LOCAL_CONCURRENCY = 1/);
assert.match(serviceSrc, /segment_time/);
assert.doesNotMatch(serviceSrc, /audio-to-text/);

assert.match(vtSrc, /transcribeAudioFileSliced/);
assert.match(vtSrc, /本机 Whisper/);
assert.doesNotMatch(vtSrc, /DIFY_SPEECH_API_KEY/);
assert.doesNotMatch(vtSrc, /files\/upload/);
assert.doesNotMatch(vtSrc, /正在提交 Dify 语音转写工作流/);

console.log('videoWhisperSliceContract tests passed');
