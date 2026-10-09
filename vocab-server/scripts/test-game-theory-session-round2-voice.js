require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createWorkflowRunner } = require('../services/englishWorkflowProxy');
const { parseWorkflowOutput } = require('../services/gameTheorySessionService');

const roles = [
  { role_id: 'r1', name: '林岚', position: '业务线负责人', hierarchy_level: 'executive', stance: '要追加预算', interest: '拿下项目窗口', is_user: true },
  { role_id: 'r2', name: '周启明', position: '财务总监', hierarchy_level: 'executive', stance: '守年度红线', interest: '控盘预算口径', is_user: false },
  { role_id: 'r3', name: '顾思远', position: '法务总监', hierarchy_level: 'middle', stance: '先把合规口径钉死', interest: '避免审计追责', is_user: false },
  { role_id: 'r4', name: '陈薇', position: '总裁办秘书', hierarchy_level: 'peer', stance: '观察站队', interest: '向总裁同步风向', is_user: false },
];

const rounds = [
  {
    round_no: 1,
    user_input: '我建议先冻结非核心项目预算，本周只开财务、业务、法务三方对账会。',
    input_source: 'text',
    role_replies: [
      { role_id: 'r2', name: '周启明', reply: '冻结可以，但请先把非核心名单和责任人列出来。', style: '先卡口径' },
      { role_id: 'r3', name: '顾思远', reply: '对账会可以开，授权范围和责任归属要先写进纪要。', style: '钉合规' },
      { role_id: 'r4', name: '陈薇', reply: '我先同步总裁办：这是控风险，不是否决项目。', style: '传风向' },
    ],
    light_signals: ['先列冻结名单和负责人。'],
  },
];

async function main() {
  const apiKey = process.env.DIFY_GAME_THEORY_SESSION_ROUND_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!apiKey) throw new Error('missing DIFY_GAME_THEORY_SESSION_ROUND_KEY');
  const run = createWorkflowRunner({ apiKey, baseUrl });
  const payload = await run({
    userId: 'round2-voice-smoke-user',
    inputs: {
      phase: 'play_round',
      scene_type: 'corp_clash',
      game_model: 'pig_game',
      source_type: 'guided_simulation',
      psyche_mode: 'evidence_bound',
      channel: 'mixed',
      title: '跨部门预算谈判',
      scenario: '跨部门预算谈判：业务线要求追加项目预算，财务要守住年度红线，法务担心合规口径被绑架。',
      role_count: 4,
      roles_json: JSON.stringify(roles),
      history_json: JSON.stringify(rounds),
      user_input: '那我今天下班前把冻结名单发给财务，核心项目先不动。',
      input_source: 'voice',
      current_round: 1,
      max_rounds: 12,
      elapsed_minutes: 3,
      max_minutes: 30,
      user_current_profile: '',
    },
  });
  const parsed = parseWorkflowOutput(payload, ['round_result']);
  const replies = Array.isArray(parsed.role_replies) ? parsed.role_replies : [];
  const npcReplies = replies.filter((item) => String(item.role_id) !== 'r1');
  if (Number(parsed.round_no) !== 2) throw new Error(`expected round_no 2, got ${parsed.round_no}`);
  if (npcReplies.length !== 3) throw new Error(`expected 3 npc replies, got ${npcReplies.length}`);
  const empty = npcReplies.filter((item) => !String(item.reply || '').trim());
  if (empty.length) throw new Error('empty npc replies');
  console.log(JSON.stringify({
    ok: true,
    round_no: parsed.round_no,
    input_source: 'voice',
    names: npcReplies.map((item) => item.name),
    light_signals: parsed.light_signals || [],
  }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
