const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const NEW = 'https://9router.234124123.xyz/v1/audio/speech';

assert.ok(src.includes(`TTS_API_URL || '${NEW}'`), 'TTS_API_URL default must be 9router speech endpoint');
assert.ok(src.includes(`TTS_API_FALLBACK_URL || '${NEW}'`), 'TTS_API_FALLBACK_URL default must be 9router speech endpoint');
assert.ok(!src.includes('http://192.210.136.140:20128/v1/audio/speech'), 'raw 192.210 speech default must be removed');
assert.ok(!src.includes('https://23.95.214.232/v1/audio/speech'), 'old IP speech default must be removed');
assert.ok(!src.includes('if (preferEdgeTts)'), 'edge-tts must not be tried first');
assert.ok(src.includes('synthesizeWithEdgeTTS'), 'edge-tts must remain as fallback');
assert.ok(
  src.includes("TTS_API_KEY || 'sk-d2c5fb65e9516bbc-rd1lv9-762292df'"),
  'TTS_API_KEY default must match the new speech gateway'
);
assert.ok(!src.includes('sk-899c9c34738f61b5-2u53op-6ed8a313'), 'old TTS_API_KEY default must be removed');

console.log('ttsUpstreamDefault contract passed');
