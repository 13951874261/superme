import assert from 'node:assert/strict';
import test from 'node:test';
import {
  READ_PUSH_MIN_CHARS,
  countReadMaterialChars,
  evaluateReadPushQuality,
} from './readPushQuality';

test('READ_PUSH_MIN_CHARS 为 1500', () => {
  assert.equal(READ_PUSH_MIN_CHARS, 1500);
});

test('F6 夹具：countReadMaterialChars 去空白计长', () => {
  assert.equal(countReadMaterialChars('ab cd\n'), 4);
});

test('F1 夹具：1600 字套话（旨在、高度重视、统筹兼顾、综上所述）判 below_standard（密度失败）', () => {
  const text = '字'.repeat(1600) + '旨在加强监管、各方应高度重视、需统筹兼顾、综上所述。';
  const res = evaluateReadPushQuality(text);
  assert.equal(res.quality, 'below_standard');
  assert.equal(res.densityOk, false);
  assert.equal(res.genreOk, false);
});

test('F2 夹具：1200 字合格结构（带训练、条款、利益方、数字）判 below_standard（字数失败）', () => {
  const content = '某省监管函〔训练〕：第一条，某银行与某企业就100万元债务进行重组。\n第二条，某企业应如期清偿。\n第三条，各方遵守协议。' + '内容'.repeat(550);
  const res = evaluateReadPushQuality(content);
  assert.equal(res.charCount < 1500, true);
  assert.equal(res.quality, 'below_standard');
  assert.equal(res.densityOk, true);
});

test('F3 夹具：≥1500 + 某省监管函〔训练〕 + 条款 + 某银行/某企业 + 数字 判 ok', () => {
  const content = '某省监管函〔训练〕\n第一条，某银行应严格核实某企业提供的2000万元资产抵押证明。\n第二条，某企业须在30日内补齐相关审计报告。\n第三条，双方建立双向沟通机制。\n' + '正文详细背景与博弈论证。'.repeat(120);
  const res = evaluateReadPushQuality(content);
  assert.equal(res.charCount >= 1500, true);
  assert.equal(res.genreOk, true);
  assert.equal(res.detailOk, true);
  assert.equal(res.partiesOk, true);
  assert.equal(res.citationOk, true);
  assert.equal(res.densityOk, true);
  assert.equal(res.quality, 'ok');
});

test('F4 夹具：≥1500 + 国发〔2024〕12号（无训练） 判 below_standard（文号红线）', () => {
  const content = '关于印发相关规定的通知 国发〔2024〕12号\n第一条，某银行应监督某企业执行100项合规标准。\n第二条，落实责任。\n第三条，加强审核。\n' + '正文详细论证与分析过程。'.repeat(120);
  const res = evaluateReadPushQuality(content);
  assert.equal(res.charCount >= 1500, true);
  assert.equal(res.citationOk, false);
  assert.equal(res.densityOk, false);
  assert.equal(res.quality, 'below_standard');
});

test('F5 夹具：空白/短摘要 80 字 判 below_standard', () => {
  const text = '这是一个简短的摘要介绍，字数大约只有几十个字，用于测试短文本拦截。';
  const res = evaluateReadPushQuality(text);
  assert.equal(res.quality, 'below_standard');
  assert.equal(res.charCount < 1500, true);
});

