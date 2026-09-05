import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync(new URL('./useOralWarRoomSession.ts', import.meta.url), 'utf8');
const view = readFileSync(new URL('../OralWarRoom.tsx', import.meta.url), 'utf8');

test('角色练习加载缓存并通过专用 API 切换及重新生成', () => {
  for (const token of ['getSpeakingScenes', 'switchSpeakingScene', 'regenerateSpeakingScene', 'getSpeakingSceneTask', "sceneType: 'multi_role'", 'adaptMultiRoleScene']) {
    assert.match(hook, new RegExp(token));
  }
});

test('异步切换具备 abort、请求令牌、成功后原子 reset 契约', () => {
  assert.match(hook, /sceneRequestAbortRef/);
  assert.match(hook, /sceneRequestTokenRef/);
  assert.match(hook, /openingAbortRef\.current\?\.abort\(\)/);
  assert.match(hook, /clearPendingText\(\)/);
  assert.match(hook, /resetBattleState\(nextScene\.id/);
  assert.match(hook, /sceneRequestLockRef/);
  assert.match(hook, /isSceneChanging/);
  assert.match(hook, /return \(\) => \{[\s\S]*sceneRequestAbortRef\.current\?\.abort\(\)[\s\S]*sceneRequestTokenRef\.current/);
  assert.match(hook, /resolveSpeakingSceneTask/);
  assert.match(hook, /activateSpeakingSceneRef/);
  assert.match(hook, /sceneCacheLoadKeyRef\.current = loadKey/);
  assert.doesNotMatch(hook, /if \(sceneCacheLoadKeyRef\.current === loadKey\) return;[\s\S]{0,100}sceneCacheLoadKeyRef\.current = loadKey/);
  assert.match(hook, /return \(\) => \{[\s\S]*setIsSceneChanging\(false\)[\s\S]*setSceneChangeStatus\(''\)[\s\S]*setSceneChangeError\(''\)/);
  assert.match(hook, /\}, \[active, userId\]\);/);
});

test('选择静态场景后保留明确的今日个性化场景入口', () => {
  assert.match(hook, /const \[availableSpeakingScene, setAvailableSpeakingScene\]/);
  assert.match(hook, /const cancelSceneRequest/);
  assert.match(hook, /const handleActivateAvailableSpeakingScene[\s\S]*cancelSceneRequest\(\)/);
  assert.match(hook, /if \(mode === 'daily'\)[\s\S]*setSpeakingScene\(null\)/);
  assert.match(hook, /useEffect\(\(\) => \{[\s\S]*setAvailableSpeakingScene\(null\)[\s\S]*\}, \[userId\]\)/);
  assert.match(view, /进入今日个性化场景/);
  assert.match(view, /session\.availableSpeakingScene/);
  assert.match(view, /session\.handleActivateAvailableSpeakingScene/);
  assert.match(hook, /const handleSceneSelect[\s\S]*setSpeakingScene\(null\)/);
  assert.match(hook, /const handleSceneSelect[\s\S]*setDynamicRoleScene\(null\)/);
});

test('完整个性化场景每组件生命周期只记录一次使用', () => {
  assert.match(hook, /recordSpeakingSceneUse/);
  assert.match(hook, /recordedSpeakingSceneIdsRef = useRef\(new Set<string>\(\)\)/);
  assert.match(hook, /recordedSpeakingSceneIdsRef\.current\.has\(scene\.id\)/);
  assert.match(hook, /recordSpeakingSceneUse\(scene\.id, userId\)\.catch\(\(\) => \{\}\)/);
});

test('SpeakingSceneBrief 只插入角色练习区域', () => {
  assert.match(view, /import SpeakingSceneBrief/);
  assert.match(view, /session\.speakingScene \?[\s\S]*<SpeakingSceneBrief/);
  assert.doesNotMatch(view, /FreeOralConversation[^\n]*SpeakingSceneBrief/);
});
