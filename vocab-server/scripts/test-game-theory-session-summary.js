require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createWorkflowRunner } = require('../services/englishWorkflowProxy');
const { parseWorkflowOutput } = require('../services/gameTheorySessionService');

const roles = [
  { role_id: 'r1', name: '林岚', position: '业务线负责人', hierarchy_level: 'executive', stance: '要追加预算', interest: '拿下项目窗口', hidden_motive: '', is_user: true },
  { role_id: 'r2', name: '周启明', position: '财务总监', hierarchy_level: 'executive', stance: '守年度红线', interest: '控盘预算口径', hidden_motive: '不愿被业务绑架', is_user: false },
  { role_id: 'r3', name: '顾思远', position: '法务总监', hierarchy_level: 'middle', stance: '先把合规口径钉死', interest: '避免审计追责', hidden_motive: '', is_user: false },
  { role_id: 'r4', name: '陈薇', position: '总裁办秘书', hierarchy_level: 'peer', stance: '观察站队', interest: '向总裁同步风向', hidden_motive: '', is_user: false },
];

const rounds = [
  {
    round_no: 1,
    user_input: '我建议先冻结非核心项目预算，本周只开财务、业务、法务三方对账会。',
    input_source: 'text',
    role_replies: [
      { role_id: 'r2', name: '周启明', reply: '冻结可以，但请先把非核心名单和责任人列出来。', style: '先卡口径', risk_hint: '可能用名单拖延' },
      { role_id: 'r3', name: '顾思远', reply: '对账会可以开，授权范围和责任归属要先写进纪要。', style: '钉合规', risk_hint: '' },
      { role_id: 'r4', name: '陈薇', reply: '我先同步总裁办：这是控风险，不是否决项目。', style: '传风向', risk_hint: '' },
    ],
    light_signals: ['先列冻结名单和负责人，别只谈追加金额。'],
  },
];

function assertArray(name, value) {
  if (!Array.isArray(value)) throw new Error(`missing array: ${name}`);
}

function assertObject(name, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`missing object: ${name}`);
}

async function main() {
  const apiKey = process.env.DIFY_GAME_THEORY_SESSION_SUMMARY_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!apiKey) throw new Error('missing DIFY_GAME_THEORY_SESSION_SUMMARY_KEY');
  const run = createWorkflowRunner({ apiKey, baseUrl });
  const payload = await run({
    userId: 'summary-smoke-user',
    inputs: {
      scene_type: 'corp_clash',
      game_model: 'pig_game',
      source_type: 'guided_simulation',
      psyche_mode: 'evidence_bound',
      title: '跨部门预算谈判',
      scenario: '跨部门预算谈判：业务线要求追加项目预算，财务要守住年度红线，法务担心合规口径被绑架。',
      roles_json: JSON.stringify(roles),
      history_json: JSON.stringify(rounds),
      current_round: 1,
      elapsed_minutes: 2,
      stop_reason: 'user_stop',
      user_current_profile: '',
    },
  });
  const summary = parseWorkflowOutput(payload, ['summary_result']);
  assertArray('hierarchy', summary.hierarchy);
  assertObject('stance', summary.stance);
  assertObject('interests', summary.interests);
  assertObject('psyche', summary.psyche);
  assertArray('alliances', summary.alliances);
  assertArray('power_chips', summary.power_chips);
  assertArray('risk_inflections', summary.risk_inflections);
  assertObject('next_actions', summary.next_actions);
  assertArray('countermeasures', summary.countermeasures);
  if (summary.hierarchy.length < 2) throw new Error('hierarchy too short');
  if (summary.countermeasures.length < 1) throw new Error('countermeasures empty');
  const psycheNames = Object.keys(summary.psyche);
  const missingClues = psycheNames.filter((name) => !Array.isArray(summary.psyche[name]?.clues));
  if (missingClues.length) throw new Error(`psyche missing clues: ${missingClues.join(',')}`);
  console.log(JSON.stringify({
    ok: true,
    hierarchy: summary.hierarchy,
    alliance_count: summary.alliances.length,
    chip_count: summary.power_chips.length,
    inflection_count: summary.risk_inflections.length,
    countermeasure_count: summary.countermeasures.length,
    psyche_names: psycheNames,
    first_countermeasure: summary.countermeasures[0],
  }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
