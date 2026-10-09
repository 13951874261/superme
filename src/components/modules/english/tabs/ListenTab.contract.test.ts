import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ListenTab.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sliceBetween(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `缺少起始标记: ${start}`);
  assert.notEqual(endIndex, -1, `缺少结束标记: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('自动加载路径只读取缓存或预生成，不调用生成 API', () => {
  const loader = sliceBetween(
    'const loadFromPregenerateOrRealtime = async',
    '  useEffect(() => {\n    if (pregenStatus',
  );
  const automaticEffects = sliceBetween(
    "useEffect(() => {\n    if (activeTab === 'listen'",
    'const handleUploadAudio',
  );

  assert.doesNotMatch(loader, /generateListenMaterial\s*\(/);
  assert.doesNotMatch(automaticEffects, /generateListenMaterial\s*\(/);
});

test('非缓存时长筛选立即清空旧材料和音频', () => {
  const filterEffect = sliceBetween(
    '// 筛选条件变化时，仅对可缓存时长重新查预生成',
    "window.addEventListener('listen-pregenerated-ready'",
  );

  assert.match(
    filterEffect,
    /if \(!CACHEABLE_DURATIONS\.includes\(listenDuration\)\) \{[\s\S]*setPregenStatus\('uncached_duration'\);[\s\S]*setListenMaterial\(''\);[\s\S]*setListenAudioUrl\(null\);[\s\S]*return;/,
  );
});

test('预生成读取异常立即清空旧材料和音频', () => {
  const loader = sliceBetween(
    'const loadFromPregenerateOrRealtime = async',
    '  useEffect(() => {\n    if (pregenStatus',
  );

  assert.match(
    loader,
    /catch \(e\) \{[\s\S]*setListenMaterial\(''\);[\s\S]*setListenAudioUrl\(null\);[\s\S]*setPregenStatus\('missing'\);/,
  );
});

test('手动生成按钮仍明确调用生成 API', () => {
  assert.match(
    source,
    /onClick=\{\(\) => generateListenMaterial\(theme\)\}[\s\S]{0,800}生成今日精听/,
  );
});
