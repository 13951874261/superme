const assert = require('assert');
const { evaluateCheckpoint, validateRoleReplies } = require('../services/gameTheorySessionService');

assert.deepEqual(evaluateCheckpoint({ value: false, roundNo: 2 }), { shouldPause: false, reason: '' });
assert.deepEqual(evaluateCheckpoint({ value: 'false', roundNo: 4, reason: '预算正式冻结', evidence: '董事长确认冻结下季度预算' }), { shouldPause: false, reason: '' });
assert.deepEqual(evaluateCheckpoint({ value: true, roundNo: 2, reason: '双方意见不一致', evidence: '仍在争论' }), { shouldPause: false, reason: '' });
assert.deepEqual(evaluateCheckpoint({ value: true, roundNo: 3, reason: '预算正式冻结', evidence: '董事长确认冻结下季度预算' }), { shouldPause: false, reason: '' });
assert.deepEqual(evaluateCheckpoint({ value: true, roundNo: 4, type: 'budget_transferred', reason: '预算正式冻结', evidence: '董事长确认冻结下季度预算' }), { shouldPause: true, reason: '预算正式冻结' });
assert.deepEqual(evaluateCheckpoint({ value: true, roundNo: 4, type: 'ordinary_disagreement', reason: '双方仍有分歧', evidence: '双方继续争论' }), { shouldPause: false, reason: '' });
assert.deepEqual(evaluateCheckpoint({ value: true, roundNo: 4, type: 'budget_transferred', reason: '', evidence: '' }), { shouldPause: false, reason: '' });

const roles = [{ role_id: 'user', is_user: true }, { role_id: 'vp', is_user: false }];
const deepReply = '我先回应你关于排期记录的质疑：采购审批确实晚于原计划，但销售预测也在同期调整。现在我提出一个新条件，由法务今晚核验邮件时间线，明早再决定责任归属；如果你坚持此刻公开全部材料，我会要求财务同时冻结区域新增预算，直到审计结论形成。';
assert.doesNotThrow(() => validateRoleReplies([{ role_id: 'vp', reply: deepReply, new_information: '法务今晚核验邮件，财务可能冻结新增预算' }], roles));
assert.throws(() => validateRoleReplies([], roles), /所有非用户角色/);
assert.throws(() => validateRoleReplies([{ role_id: 'user', reply: '替用户发言' }], roles), /所有非用户角色/);
assert.throws(() => validateRoleReplies([{ role_id: 'vp', reply: '' }], roles), /回复不能为空/);
assert.throws(() => validateRoleReplies([{ role_id: 'vp', reply: '收到。', new_information: '无' }], roles), /回复过短/);
assert.throws(() => validateRoleReplies([{ role_id: 'vp', reply: deepReply, new_information: '' }], roles), /新增局势信息/);

console.log('OK gameTheoryCheckpoint');
