require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createWorkflowRunner } = require('../services/englishWorkflowProxy');
const { parseWorkflowOutput, normalizeRoles } = require('../services/gameTheorySessionService');

async function main() {
  const apiKey = process.env.DIFY_GAME_THEORY_SESSION_ROUND_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!apiKey) {
    throw new Error('missing DIFY_GAME_THEORY_SESSION_ROUND_KEY');
  }
  const run = createWorkflowRunner({ apiKey, baseUrl });
  const payload = await run({
    userId: 'session-smoke-user',
    inputs: {
      phase: 'generate_roles',
      scene_type: 'corp_clash',
      game_model: 'pig_game',
      source_type: 'guided_simulation',
      psyche_mode: 'evidence_bound',
      channel: 'text',
      title: '跨部门预算谈判',
      scenario: '跨部门预算谈判：业务线要求追加项目预算，财务要守住年度红线，法务担心合规口径被绑架。',
      role_count: 4,
      roles_json: '',
      history_json: '[]',
      user_input: '',
      current_round: 0,
      max_rounds: 12,
      elapsed_minutes: 0,
      max_minutes: 30,
      user_current_profile: '',
    },
  });
  const parsed = parseWorkflowOutput(payload, ['round_result']);
  const roles = normalizeRoles(parsed.roles);
  console.log(JSON.stringify({
    ok: true,
    phase: parsed.phase,
    role_count: roles.length,
    names: roles.map((r) => r.name),
  }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
