const {
  normalizeRoles,
  limitHit,
  parseWorkflowOutput,
  elapsedMinutes,
} = require('../services/gameTheorySessionService');

const roles = normalizeRoles([
  { name: '陈维', position: '财务总监', hierarchy_level: 'executive', stance: '守预算', interest: '控盘' },
  { name: '周宁', position: '业务VP', hierarchy_level: 'executive', stance: '要加码', interest: '扩张' },
]);
if (roles.length !== 2) throw new Error('roles');

let threw = false;
try {
  normalizeRoles([roles[0]]);
} catch (_) {
  threw = true;
}
if (!threw) throw new Error('role count');

const hit = limitHit({ current_round: 12, max_rounds: 12, max_minutes: 30 }, { elapsed_ms: 0 });
if (hit !== 'max_rounds') throw new Error('limit');

const mins = elapsedMinutes({ elapsed_ms: 29 * 60 * 1000 });
if (mins !== 29) throw new Error('elapsed');

const parsed = parseWorkflowOutput({
  data: { outputs: { round_result: '{"phase":"generate_roles","roles":[]}' } },
}, ['round_result']);
if (parsed.phase !== 'generate_roles') throw new Error('parse');

if (limitHit({ current_round: 11, max_rounds: 12, max_minutes: 30 }, { elapsed_ms: 0 })) {
  throw new Error('11 rounds should not hit');
}
if (limitHit({ current_round: 2, max_rounds: 2, max_minutes: 30 }, { elapsed_ms: 0 }) !== 'max_rounds') {
  throw new Error('custom round cap');
}
if (limitHit({ current_round: 0, max_rounds: 12, max_minutes: 1 }, { elapsed_ms: 60 * 1000 }) !== 'max_minutes') {
  throw new Error('1 minute cap');
}
if (limitHit({ current_round: 0, max_rounds: 12, max_minutes: 30 }, { elapsed_ms: 29 * 60 * 1000 })) {
  throw new Error('29 minutes should not hit');
}

console.log('unit_ok');
