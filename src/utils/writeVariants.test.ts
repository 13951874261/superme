import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultWriteModuleId,
  mapGovernanceToReview,
  writeModulesFor,
} from './writeVariants';

test('中文入口只有文治三件套，默认公文，不含英文商务信函', () => {
  const mods = writeModulesFor('zh');
  assert.deepEqual(mods.map((m) => m.id), ['gov_write', 'biz_zh', 'personal_brand']);
  assert.equal(mods.every((m) => m.review === 'governance'), true);
  assert.equal(defaultWriteModuleId('zh'), 'gov_write');
  assert.equal(mods.some((m) => m.id === 'biz_proposal'), false);
});

test('英语入口只有英文写作三项，默认商务信函，不含体制内公文', () => {
  const mods = writeModulesFor('en');
  assert.deepEqual(mods.map((m) => m.id), ['biz_proposal', 'limit_challenge', 'essay_reflection']);
  assert.equal(mods.every((m) => m.review === 'english'), true);
  assert.equal(defaultWriteModuleId('en'), 'biz_proposal');
  assert.equal(mods.some((m) => m.id === 'gov_write'), false);
});

test('文治三类结果映射到审阅卡片，不混用英语 L1 字段名', () => {
  const doc = mapGovernanceToReview({
    taskType: 'document_correction',
    level_1: '格式',
    level_2: '逻辑',
    level_3: '站位',
    rawJson: JSON.stringify({ optimized_version: '改写稿' }),
  });
  assert.equal(doc.L1, '格式');
  assert.equal(doc.optimized_version, '改写稿');

  const biz = mapGovernanceToReview({
    taskType: 'business_writing',
    tone_evaluation: '语气',
    skill_point: '技能',
    compressed_text: '压缩稿',
  });
  assert.equal(biz.L1, '语气');
  assert.equal(biz.L2, '技能');
  assert.equal(biz.optimized_version, '压缩稿');

  const val = mapGovernanceToReview({
    taskType: 'value_proposal',
    admin_flaws: '行政痕迹',
    value_extraction: '价值',
    business_proposal: '提案',
  });
  assert.equal(val.L1, '行政痕迹');
  assert.equal(val.optimized_version, '提案');
});
