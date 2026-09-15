const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const NEW = 'https://fetch.234124123.xyz/v1/audio/speech';

assert.ok(src.includes(`TTS_API_URL || '${NEW}'`), 'TTS_API_URL default must be fetch speech endpoint');
assert.ok(src.includes(`TTS_API_FALLBACK_URL || '${NEW}'`), 'TTS_API_FALLBACK_URL default must be fetch speech endpoint');
assert.ok(!src.includes('http://192.210.136.140:20128/v1/audio/speech'), 'raw 192.210 speech default must be removed');
assert.ok(!src.includes('https://9router.234124123.xyz/v1/audio/speech'), 'old 9router speech default must be removed');
assert.ok(!src.includes('if (preferEdgeTts)'), 'edge-tts must not be tried first');
assert.ok(src.includes('synthesizeWithEdgeTTS'), 'edge-tts must remain as fallback');
assert.ok(src.includes('process.env.TTS_API_KEY'), 'TTS_API_KEY must come from environment');
assert.ok(!/TTS_API_KEY\s*\|\|\s*['"]sk-/.test(src), 'TTS_API_KEY must not have a plaintext fallback');
assert.ok(!/TTS_API_KEY\s*\|\|\s*['"][^'"]+/.test(src), 'TTS_API_KEY must not contain a plaintext value');
assert.ok(src.includes("'CONFIGURATION_ERROR'"), 'missing TTS_API_KEY must return stable CONFIGURATION_ERROR');

console.log('ttsUpstreamDefault contract passed');
