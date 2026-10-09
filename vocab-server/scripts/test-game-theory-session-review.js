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
      { role_id: 'r2', name: '周启明', reply: '冻结可以，但请先把非核心名单和责任人列出来。', style: '先卡口径' },
      { role_id: 'r3', name: '顾思远', reply: '对账会可以开，授权范围和责任归属要先写进纪要。', style: '钉合规' },
      { role_id: 'r4', name: '陈薇', reply: '我先同步总裁办：这是控风险，不是否决项目。', style: '传风向' },
    ],
    light_signals: ['先列冻结名单和负责人，别只谈追加金额。'],
  },
];

const summary = {
  hierarchy: ['林岚', '周启明', '顾思远', '陈薇'],
  stance: { 林岚: '先冻结非核心预算再开会', 周启明: '守红线并要名单', 顾思远: '先钉授权与责任', 陈薇: '向总裁办传风向' },
  interests: { 林岚: ['保住项目窗口'], 周启明: ['控预算口径'], 顾思远: ['降低审计风险'], 陈薇: ['准确同步'] },
  psyche: {
    林岚: { observation: '用冻结换时间', clues: ['R1：先冻结非核心项目预算'], confidence: 0.62, mode: 'evidence_bound' },
    周启明: { observation: '用名单卡进度', clues: ['R1：先把非核心名单和责任人列出来'], confidence: 0.7, mode: 'evidence_bound' },
  },
  alliances: [],
  power_chips: [{ owner: '周启明', chip: '预算红线解释权', impact: '可拖延追加' }],
  risk_inflections: ['R1：冻结动议把讨论从加码改成名单'],
  next_actions: { 林岚: ['补冻结名单'], 周启明: ['要责任人'] },
  countermeasures: ['先与财务对齐冻结口径，再开会'],
};

function asItem(item) {
  return typeof item === 'string' ? { claim: item } : (item || {});
}

async function main() {
  const apiKey = process.env.DIFY_GAME_THEORY_SESSION_REVIEW_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!apiKey) throw new Error('missing DIFY_GAME_THEORY_SESSION_REVIEW_KEY');
  const run = createWorkflowRunner({ apiKey, baseUrl });
  const payload = await run({
    userId: 'review-smoke-user',
    inputs: {
      scene_type: 'corp_clash',
      game_model: 'pig_game',
      source_type: 'guided_simulation',
      psyche_mode: 'evidence_bound',
      title: '跨部门预算谈判',
      scenario: '跨部门预算谈判：业务线要求追加项目预算，财务要守住年度红线，法务担心合规口径被绑架。',
      roles_json: JSON.stringify(roles),
      history_json: JSON.stringify(rounds),
      summary_json: JSON.stringify(summary),
      user_role_id: 'r1',
      user_role_name: '林岚',
      current_round: 1,
      elapsed_minutes: 2,
      user_current_profile: '',
    },
  });
  const review = parseWorkflowOutput(payload, ['review_result']);
  if (!Array.isArray(review.missteps) || review.missteps.length < 1) throw new Error('missteps missing');
  if (!Array.isArray(review.missed_moments)) throw new Error('missed_moments missing');
  if (!Array.isArray(review.strategy_guidance) || review.strategy_guidance.length < 1) throw new Error('strategy_guidance missing');
  if (!Array.isArray(review.strengths)) throw new Error('strengths missing');
  const firstMisstep = asItem(review.missteps[0]);
  if (!firstMisstep.claim && !firstMisstep.evidence) throw new Error('misstep empty');
  const firstMoment = review.missed_moments[0];
  if (firstMoment && (firstMoment.round_no == null || !firstMoment.issue || !firstMoment.avoid_action)) {
    throw new Error('missed_moments fields incomplete');
  }
  console.log(JSON.stringify({
    ok: true,
    misstep_count: review.missteps.length,
    strength_count: review.strengths.length,
    missed_count: review.missed_moments.length,
    guidance_count: review.strategy_guidance.length,
    first_misstep: firstMisstep.claim || firstMisstep.evidence,
    first_guidance: review.strategy_guidance[0],
    has_evidence: Boolean(firstMisstep.evidence),
    has_confidence: firstMisstep.confidence != null,
  }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
