const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
const serverSource = fs.readFileSync(serverPath, 'utf8');

assert.ok(
  !/effects\.accent === 'indian'/.test(serverSource),
  'applyAudioEffects must not branch on effects.accent indian'
);
assert.ok(
  !/rubberband=pitch/.test(serverSource),
  'accent rubberband pitch filters must be removed'
);

const pregenPath = path.join(__dirname, '../services/dailyListenPreGenerateService.js');
const pregenSource = fs.readFileSync(pregenPath, 'utf8');
assert.ok(
  !/edge-tts\/en-US-EmmaNeural/.test(pregenSource),
  'default EmmaNeural must be removed from pregenerate synthesize'
);
assert.ok(
  pregenSource.includes('getListenVoiceId') || pregenSource.includes('listenPrefsService'),
  'pregenerate must read listen prefs voice'
);
assert.ok(
  pregenSource.includes('CRON_FORCE_LISTEN_EFFECTS') || pregenSource.includes('interruptions: true'),
  'pregenerate must apply forced pressure effects'
);

assert.ok(serverSource.includes('/api/english/listen-prefs'), 'listen-prefs API must exist');

const listenTabPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenTab.tsx');
const listenTabSource = fs.readFileSync(listenTabPath, 'utf8');
assert.ok(listenTabSource.includes('ListenVoicePicker'), 'ListenTab must use ListenVoicePicker');
assert.ok(listenTabSource.includes('背景白噪'), 'information_gap label must describe the implemented background-noise effect');
assert.ok(!/印度口音 \(India\)/.test(listenTabSource), 'old accent select labels must be removed from ListenTab');
assert.ok(!/accent:\s*\(s\.listenAccent/.test(listenTabSource), 'buildListenTtsEffects must not send accent');

assert.ok(
  serverSource.includes("between(t\\\\,0.5\\\\,0.72)"),
  'packet_loss must mute an audible time range instead of one exact sample'
);
assert.ok(
  !serverSource.includes("if(eq(t\\\\,0.5)"),
  'packet_loss must not rely on exact floating-point timestamp equality'
);

const pickerPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenVoicePicker.tsx');
assert.ok(fs.existsSync(pickerPath), 'ListenVoicePicker.tsx must exist');
const pickerSource = fs.readFileSync(pickerPath, 'utf8');
assert.ok(pickerSource.includes('useGSAP'), 'Voice picker must use useGSAP');
assert.ok(pickerSource.includes('VOICE_OPTIONS'), 'Voice picker must use VOICE_OPTIONS');

const ttsApiPath = path.join(__dirname, '../../src/services/ttsAPI.ts');
const ttsApiSource = fs.readFileSync(ttsApiPath, 'utf8');
assert.ok(!/accent\?: 'indian'/.test(ttsApiSource), 'ttsAPI effects must not include accent');

console.log('listenVoicePressure full contract passed');
