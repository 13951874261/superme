const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 测试文件存在性
const servicePath = path.join(__dirname, '../services/audioTranscriptionService.js');
assert.ok(fs.existsSync(servicePath), 'audioTranscriptionService.js must exist');

// 测试导出结构
const service = require(servicePath);
assert.ok(typeof service.transcribeAudioFile === 'function', 'transcribeAudioFile must be exported');

// 测试接口定义 - 读取源码验证签名
const source = fs.readFileSync(servicePath, 'utf8');
assert.match(source, /async function transcribeAudioFile/);
assert.match(source, /127\.0\.0\.1:8080\/inference/);
assert.match(source, /不再降级/);
assert.match(source, /callPolishLLM/);

// 测试 server.js 中的路由是否引用了该服务
const serverPath = path.join(__dirname, '../server.js');
const serverSource = fs.readFileSync(serverPath, 'utf8');
assert.match(serverSource, /audioTranscriptionService/);
assert.match(serverSource, /transcribeAudioFile/);

// 测试前端 listeningAPI.ts 包含新函数
const listeningApiPath = path.join(__dirname, '../../src/services/listeningAPI.ts');
const listeningApiSource = fs.readFileSync(listeningApiPath, 'utf8');
assert.ok(listeningApiSource.includes('uploadLocalListeningAudio'), 'uploadLocalListeningAudio must exist in listeningAPI.ts');
assert.ok(listeningApiSource.includes('voiceId'), 'voiceId parameter must exist in fetchDifyTTS');
assert.ok(listeningApiSource.includes('effects'), 'effects parameter must exist in fetchDifyTTS');

// 测试前端 ttsAPI.ts 包含 effects
const ttsApiPath = path.join(__dirname, '../../src/services/ttsAPI.ts');
const ttsApiSource = fs.readFileSync(ttsApiPath, 'utf8');
assert.ok(ttsApiSource.includes('effects?:'), 'effects must be in TtsSpeechOptions');

// 测试 BlindListeningCabin.tsx 包含新功能
const cabinPath = path.join(__dirname, '../../src/components/BlindListeningCabin.tsx');
const cabinSource = fs.readFileSync(cabinPath, 'utf8');
assert.ok(cabinSource.includes('VOICE_OPTIONS'), 'VOICE_OPTIONS must exist');
assert.ok(cabinSource.includes('selectedVoiceId'), 'selectedVoiceId state must exist');
assert.ok(cabinSource.includes('effects'), 'effects state must exist');
assert.ok(cabinSource.includes('handleFileUpload'), 'handleFileUpload must exist');
assert.ok(cabinSource.includes('uploadLocalListeningAudio'), 'uploadLocalListeningAudio import must exist');
assert.ok(cabinSource.includes('网络卡顿') || cabinSource.includes('packet_loss'), 'packet_loss effect button must exist');
assert.ok(cabinSource.includes('声音打断') || cabinSource.includes('interruptions'), 'interruptions effect button must exist');
assert.ok(cabinSource.includes('背景噪音') || cabinSource.includes('information_gap'), 'information_gap effect button must exist');

const listenTabPath = path.join(__dirname, '../../src/components/modules/english/tabs/ListenTab.tsx');
const listenTabSource = fs.readFileSync(listenTabPath, 'utf8');
assert.ok(listenTabSource.includes('uploadLocalListeningAudio'), 'ListenTab must use uploadLocalListeningAudio');
assert.ok(!listenTabSource.includes('/api/audio/transcriptions'), 'ListenTab must not call secondary STT');
assert.ok(listenTabSource.includes('effects: buildListenTtsEffects()'), 'ListenTab must pass effects into fetchDifyTTS');
assert.match(serverSource, /path: filePath/);

console.log('upload-audio + TTS stress factors contract tests passed');
