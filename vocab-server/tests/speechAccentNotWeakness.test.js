const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const helperPath = path.join(root, 'src/utils/profileHelper.ts');
const tabPath = path.join(root, 'src/components/modules/english/tabs/ImpromptuSpeechTab.tsx');
const difyPath = path.join(root, 'src/services/difyAPI.ts');

function read(p) {
  assert.ok(fs.existsSync(p), `缺少文件: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function extractFn(src, name) {
  const start = src.indexOf(`export function ${name}`);
  assert.ok(start >= 0, `找不到 ${name}`);
  let depth = 0;
  let i = src.indexOf('{', start);
  assert.ok(i >= 0, `${name} 无函数体`);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`未能截取 ${name}`);
}

function testSanitizeWeaknessProfileBehavior() {
  const dailyPack = require('../services/dailyPackService');
  assert.strictEqual(dailyPack.sanitizeWeaknessProfile('英国 (UK)'), '');
  assert.strictEqual(dailyPack.sanitizeWeaknessProfile('美国 (US)'), '');
  assert.strictEqual(dailyPack.sanitizeWeaknessProfile('时态混乱; 英国 (UK)'), '时态混乱');
  assert.strictEqual(dailyPack.sanitizeWeaknessProfile('用词空泛，美国 (US)，衔接生硬'), '用词空泛; 衔接生硬');
  assert.strictEqual(dailyPack.sanitizeWeaknessProfile('因果倒置'), '因果倒置');

  const helper = read(helperPath);
  assert.match(helper, /export function isAccentProfile/, '前端必须有同样的地区标签判断');
  assert.match(helper, /export function sanitizeWeaknessProfile/, '前端必须有短板过滤');
  const isAccent = extractFn(helper, 'isAccentProfile');
  assert.match(isAccent, /英国 \(UK\)/);
  assert.match(isAccent, /美国 \(US\)/);
}

function testSpeechTabAndDifyUseWeaknessHelper() {
  const helper = read(helperPath);
  assert.match(helper, /export function getUserWeaknessProfile/, '必须导出 getUserWeaknessProfile');
  const injectStart = helper.indexOf('export function injectUserProfile');
  assert.ok(injectStart >= 0, '找不到 injectUserProfile');
  const inject = helper.slice(injectStart, injectStart + 1800);
  assert.match(inject, /getUserWeaknessProfile|sanitizeWeaknessProfile/, '注入 Weakness 不得用未过滤的地区标签');

  const tab = read(tabPath);
  assert.match(tab, /getUserWeaknessProfile/, '即兴演讲必须读短板而不是原画像');
  assert.doesNotMatch(
    tab,
    /setUserProfile\(getUserCurrentProfile\(\)\)/,
    '即兴演讲高压条不得直接用 getUserCurrentProfile',
  );

  const dify = read(difyPath);
  assert.match(dify, /user_weakness_profile:\s*(getUserWeaknessProfile\(\)|sanitizeWeaknessProfile\()/, '口语弱点槽必须走过滤后的短板');
}

testSanitizeWeaknessProfileBehavior();
console.log('PASS sanitizeWeaknessProfile 过滤地区标签');
function testReviewAreaDoesNotShowAccentAsWeakness() {
  const helper = read(helperPath);
  assert.match(helper, /export function getAccentPref/, '口音必须单独存，不能写进短板');
  assert.match(helper, /export function saveAccentPref/, '改口音不得调用 saveUserCurrentProfile');
  const fromText = extractFn(helper, 'updateProfileFromText');
  assert.match(fromText, /saveAccentPref/, '文本里的英音/美音只改口音');
  assert.doesNotMatch(fromText, /saveUserCurrentProfile\(/, '文本切口音不得覆盖短板');

  const summary = read(path.join(root, 'src/components/SummaryArea.tsx'));
  assert.match(summary, /getUserWeaknessProfile/, '复盘短板必须读过滤后的短板');
  assert.match(summary, /暂无短板/, '没有短板时不得回退成英国');
  assert.doesNotMatch(summary, /getUserCurrentProfile\(\)/, '复盘区不得直接展示原画像');

  const settings = read(path.join(root, 'src/components/GlobalSettingsPanel.tsx'));
  assert.match(settings, /saveAccentPref\('英国 \(UK\)'\)/, '设置里的英国按钮只改口音');
  assert.doesNotMatch(settings, /saveUserCurrentProfile\('英国 \(UK\)'\)/, '设置不得把英国写进短板');

  const right = read(path.join(root, 'src/components/RightPanel.tsx'));
  assert.match(right, /saveAccentPref/, '右侧画像菜单的英美选项只改口音');
}

testSpeechTabAndDifyUseWeaknessHelper();
console.log('PASS 即兴演讲 / Dify 弱点槽改用短板读取');
testReviewAreaDoesNotShowAccentAsWeakness();
console.log('PASS 复盘/设置不再把英国当短板');
console.log('\nspeechAccentNotWeakness.test.js 全部通过');
