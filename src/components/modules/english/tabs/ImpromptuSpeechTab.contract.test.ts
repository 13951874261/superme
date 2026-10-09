import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ImpromptuSpeechTab.tsx', import.meta.url), 'utf8');

test('即兴演讲接入缓存、题卡、换题轮询和重新生成', () => {
  for (const token of ['SpeakingSceneBrief', 'getSpeakingScenes', 'switchSpeakingScene', 'regenerateSpeakingScene', "sceneType: 'impromptu'", 'resolveSpeakingSceneTask']) {
    assert.match(source, new RegExp(token));
  }
  assert.ok(source.indexOf('<SpeakingSceneBrief') < source.indexOf('录音主控区'));
});

test('空缓存显示 fallback 并仅后台 regenerate 一次', () => {
  assert.match(source, /buildFallbackImpromptuScene/);
  assert.match(source, /fallbackRegenerateKeyRef/);
  assert.match(source, /if \(cached\)[\s\S]*return;[\s\S]*setSpeakingScene\(fallback\)[\s\S]*fallbackRegenerateKeyRef\.current === loadKey[\s\S]*regenerateSpeakingScene/);
});

test('base theme 仅在无个性化场景或 fallback 时更新并 reset', () => {
  assert.match(source, /isFallbackImpromptuScene/);
  assert.match(source, /baseTheme/);
  assert.match(source, /resetSpeechSession\(\)[\s\S]*buildFallbackImpromptuScene/);
});

test('getUserMedia 后立即跟踪 stream，MediaRecorder 失败停止 tracks', () => {
  assert.match(source, /getUserMedia\([\s\S]*streamRef\.current = stream/);
  assert.match(source, /catch \(err:[\s\S]*stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)[\s\S]*streamRef\.current = null/);
});

test('场景请求具备 busy 锁、Abort、generation token 和成功后统一 reset', () => {
  for (const token of ['sceneRequestLockRef', 'sceneRequestAbortRef', 'sceneGenerationRef', 'resetSpeechSession', 'URL.revokeObjectURL', 'stopSpeaking']) {
    assert.match(source, new RegExp(token.replace('.', '\\.')));
  }
  assert.match(source, /activateImpromptuScene[\s\S]*resetSpeechSession/);
  assert.match(source, /useEffect\(\(\) => \(\) => \{[\s\S]*abort\(\)[\s\S]*sceneGenerationRef\.current/);
});
