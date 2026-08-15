const crypto = require('crypto');
const { createWorkflowRunner } = require('./englishWorkflowProxy');

const SCENE_TYPES = new Set(['gov_struggle', 'corp_clash', 'upward_takeover']);
const GAME_MODELS = new Set(['prisoner_dilemma', 'pig_game', 'info_asymmetry', 'cold_trigger']);
const SOURCE_TYPES = new Set(['guided_simulation', 'real_record']);
const PSYCHE_MODES = new Set(['evidence_bound', 'assertive']);
const CHANNELS = new Set(['text', 'voice', 'mixed']);
const INPUT_SOURCES = new Set(['text', 'voice']);
const HIERARCHY = new Set(['executive', 'middle', 'peer', 'external']);
const CONTROL_ACTIONS = new Set(['start', 'pause', 'resume', 'stop']);
const STOP_REASONS = new Set(['user_stop', 'max_rounds', 'max_minutes', 'paused']);

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isRetryableWorkflowError(err) {
  const status = Number(err?.statusCode || 0);
  const message = String(err?.message || '');
  return status === 524 || status === 502 || status === 503 || /524|502|503/.test(message);
}

async function withWorkflowRetry(fn, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRetryableWorkflowError(err)) throw err;
    }
  }
  throw lastErr;
}

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function extractJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!text) throw httpError(502, '工作流返回为空');
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw httpError(502, '工作流返回不是合法 JSON');
  }
}

function parseWorkflowOutput(payload, preferredKeys) {
  const outputs = payload?.data?.outputs || {};
  for (const key of preferredKeys) {
    if (outputs[key] != null && outputs[key] !== '') {
      return extractJson(outputs[key]);
    }
  }
  if (outputs.result != null && outputs.result !== '') return extractJson(outputs.result);
  if (outputs.text != null && outputs.text !== '') return extractJson(outputs.text);
  throw httpError(502, '工作流未返回可解析结果');
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeRole(raw, index) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const hierarchy = HIERARCHY.has(item.hierarchy_level) ? item.hierarchy_level : 'peer';
  const name = String(item.name || '').trim();
  const position = String(item.position || '').trim();
  if (!name || !position) {
    throw httpError(400, `角色 ${index + 1} 缺少姓名或职务`);
  }
  return {
    id: String(item.role_id || item.id || `r${index + 1}`).trim() || `r${index + 1}`,
    name,
    position,
    hierarchy_level: hierarchy,
    stance: String(item.stance || '').trim(),
    interest: String(item.interest || '').trim(),
    hidden_motive: String(item.hidden_motive || '').trim(),
    is_user: item.is_user === true || index === 0,
  };
}

function normalizeRoles(list) {
  if (!Array.isArray(list)) throw httpError(400, '角色必须是数组');
  if (list.length < 2 || list.length > 5) {
    throw httpError(400, '角色人数必须是 2 到 5 人');
  }
  return list.map((item, index) => normalizeRole(item, index));
}

function pickEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  if (allowed.has(text)) return text;
  return fallback;
}

function parseState(raw) {
  const state = parseJson(raw, {}) || {};
  return {
    elapsed_ms: Number(state.elapsed_ms || 0),
    last_tick_at: Number(state.last_tick_at || 0),
    phase: state.phase || 'play',
    history_id: state.history_id || '',
    last_round_summary: state.last_round_summary || '',
    summary: state.summary || null,
    review: state.review || null,
    stop_reason: state.stop_reason || '',
  };
}

function tickElapsed(session, now = Date.now()) {
  const state = parseState(session.state_json);
  if (session.status === 'active' && state.last_tick_at) {
    state.elapsed_ms += Math.max(0, now - state.last_tick_at);
  }
  state.last_tick_at = now;
  return state;
}

function elapsedMinutes(state) {
  return Math.floor(Number(state.elapsed_ms || 0) / 60000);
}

function limitHit(session, state) {
  if (Number(session.current_round || 0) >= Number(session.max_rounds || 12)) return 'max_rounds';
  if (Number(state.elapsed_ms || 0) >= Number(session.max_minutes || 30) * 60 * 1000) return 'max_minutes';
  return null;
}

function limitMessage(hit, session, suffix = '') {
  if (hit === 'max_rounds') return `已达 ${session.max_rounds || 12} 轮上限${suffix}`;
  if (hit === 'max_minutes') return `已达 ${session.max_minutes || 30} 分钟上限${suffix}`;
  return '已达会话上限';
}

function initGameTheorySessionTables(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_theory_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scene_type TEXT NOT NULL,
      game_model TEXT NOT NULL,
      source_type TEXT NOT NULL,
      scenario TEXT NOT NULL,
      psyche_mode TEXT NOT NULL DEFAULT 'evidence_bound',
      channel TEXT NOT NULL DEFAULT 'text',
      status TEXT NOT NULL DEFAULT 'draft',
      current_round INTEGER DEFAULT 0,
      max_rounds INTEGER DEFAULT 12,
      max_minutes INTEGER DEFAULT 30,
      started_at INTEGER,
      ended_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000),
      updated_at INTEGER DEFAULT (strftime('%s','now')*1000),
      config_json TEXT,
      state_json TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_theory_session_roles (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      position TEXT NOT NULL,
      hierarchy_level TEXT NOT NULL,
      stance TEXT NOT NULL,
      interest TEXT NOT NULL,
      hidden_motive TEXT,
      is_user INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_theory_session_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      round_no INTEGER NOT NULL,
      user_input TEXT NOT NULL,
      input_source TEXT NOT NULL,
      role_replies_json TEXT NOT NULL,
      light_signals_json TEXT,
      need_checkpoint INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )
  `).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_gt_session_user_status ON game_theory_sessions(user_id, status, updated_at)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_gt_session_roles_session ON game_theory_session_roles(session_id, sort_order)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_gt_session_rounds_session ON game_theory_session_rounds(session_id, round_no)').run();
}

function createGameTheorySessionService({ db, baseUrl, keys }) {
  const runRoundWorkflow = createWorkflowRunner({ apiKey: keys.round, baseUrl });
  const runSummaryWorkflow = createWorkflowRunner({ apiKey: keys.summary, baseUrl });
  const runReviewWorkflow = createWorkflowRunner({ apiKey: keys.review, baseUrl });

  function saveSessionRow(session, extra = {}) {
    const now = extra.updated_at || Date.now();
    db.prepare(`
      UPDATE game_theory_sessions
      SET status = ?, current_round = ?, started_at = ?, ended_at = ?, updated_at = ?, state_json = ?, config_json = ?
      WHERE id = ?
    `).run(
      extra.status ?? session.status,
      extra.current_round ?? session.current_round,
      extra.started_at ?? session.started_at,
      extra.ended_at ?? session.ended_at,
      now,
      extra.state_json ?? session.state_json,
      extra.config_json ?? session.config_json,
      session.id
    );
  }

  function loadSession(sessionId, userId) {
    const session = db.prepare('SELECT * FROM game_theory_sessions WHERE id = ?').get(sessionId);
    if (!session) throw httpError(404, '会话不存在');
    if (userId && session.user_id !== userId) throw httpError(403, '无权访问该会话');
    return session;
  }

  function loadRoles(sessionId) {
    const rows = db.prepare(`
      SELECT id, role_name, position, hierarchy_level, stance, interest, hidden_motive, is_user, sort_order
      FROM game_theory_session_roles
      WHERE session_id = ?
      ORDER BY sort_order ASC
    `).all(sessionId);
    const prefix = `${sessionId}_`;
    return rows.map((row) => ({
      role_id: row.id.startsWith(prefix) ? row.id.slice(prefix.length) : row.id,
      name: row.role_name,
      position: row.position,
      hierarchy_level: row.hierarchy_level,
      stance: row.stance,
      interest: row.interest,
      hidden_motive: row.hidden_motive || '',
      is_user: !!row.is_user,
    }));
  }

  function loadRounds(sessionId) {
    const rows = db.prepare(`
      SELECT round_no, user_input, input_source, role_replies_json, light_signals_json, need_checkpoint, created_at
      FROM game_theory_session_rounds
      WHERE session_id = ?
      ORDER BY round_no ASC
    `).all(sessionId);
    return rows.map((row) => ({
      round_no: row.round_no,
      user_input: row.user_input,
      input_source: row.input_source,
      role_replies: parseJson(row.role_replies_json, []),
      light_signals: parseJson(row.light_signals_json, []),
      need_checkpoint: !!row.need_checkpoint,
      created_at: row.created_at,
    }));
  }

  function replaceRoles(sessionId, roles) {
    const now = Date.now();
    db.prepare('DELETE FROM game_theory_session_roles WHERE session_id = ?').run(sessionId);
    const insert = db.prepare(`
      INSERT INTO game_theory_session_roles
      (id, session_id, role_name, position, hierarchy_level, stance, interest, hidden_motive, is_user, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    roles.forEach((role, index) => {
      const rawId = String(role.role_id || role.id || `r${index + 1}`).trim() || `r${index + 1}`;
      const uniqueId = rawId.startsWith(`${sessionId}_`) ? rawId : `${sessionId}_${rawId}`;
      insert.run(
        uniqueId,
        sessionId,
        role.name,
        role.position,
        role.hierarchy_level,
        role.stance,
        role.interest,
        role.hidden_motive || '',
        role.is_user ? 1 : 0,
        index,
        now
      );
    });
  }

  function serializeSession(session) {
    const state = parseState(session.state_json);
    const roles = loadRoles(session.id);
    const rounds = loadRounds(session.id);
    const liveState = session.status === 'active' ? tickElapsed(session) : state;
    return {
      session_id: session.id,
      user_id: session.user_id,
      title: session.title,
      scene_type: session.scene_type,
      game_model: session.game_model,
      source_type: session.source_type,
      scenario: session.scenario,
      psyche_mode: session.psyche_mode,
      channel: session.channel,
      status: session.status,
      current_round: session.current_round,
      max_rounds: session.max_rounds,
      max_minutes: session.max_minutes,
      elapsed_minutes: elapsedMinutes(liveState),
      elapsed_ms: Number(liveState.elapsed_ms || 0),
      started_at: session.started_at,
      ended_at: session.ended_at,
      created_at: session.created_at,
      updated_at: session.updated_at,
      phase: liveState.phase,
      stop_reason: liveState.stop_reason || '',
      last_round_summary: liveState.last_round_summary || '',
      roles,
      rounds,
      summary: liveState.summary,
      review: liveState.review,
      limit_hit: limitHit(session, liveState),
    };
  }

  function persistState(session, state, extra = {}) {
    const payload = JSON.stringify(state);
    saveSessionRow(session, { ...extra, state_json: payload });
    session.state_json = payload;
    if (extra.status) session.status = extra.status;
    if (extra.current_round != null) session.current_round = extra.current_round;
    if (extra.started_at !== undefined) session.started_at = extra.started_at;
    if (extra.ended_at !== undefined) session.ended_at = extra.ended_at;
  }

  function upsertHistory(session, state, { suggestion, causalChain, fullResult, isSuccess }) {
    const now = Date.now();
    const historyId = state.history_id || crypto.randomUUID();
    const existing = state.history_id
      ? db.prepare('SELECT id FROM game_theory_history WHERE id = ?').get(state.history_id)
      : null;
    if (existing) {
      db.prepare(`
        UPDATE game_theory_history
        SET suggestion = ?, causal_chain_json = ?, full_result_json = ?, is_success = ?
        WHERE id = ?
      `).run(
        suggestion || '',
        JSON.stringify(causalChain || []),
        JSON.stringify(fullResult || {}),
        isSuccess ? 1 : 0,
        historyId
      );
    } else {
      db.prepare(`
        INSERT INTO game_theory_history (
          id, user_id, source_type, title, scene_type, game_model,
          score, is_success, suggestion, causal_chain_json, full_result_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        historyId,
        session.user_id,
        'session',
        String(session.title || '多人群体博弈会话').slice(0, 120),
        session.scene_type,
        session.game_model,
        0,
        isSuccess ? 1 : 0,
        suggestion || '',
        JSON.stringify(causalChain || []),
        JSON.stringify(fullResult || {}),
        now
      );
    }
    state.history_id = historyId;
    return historyId;
  }

  async function generateRolesFromDify(session, roleCount, userCurrentProfile) {
    const payload = await runRoundWorkflow({
      userId: session.user_id,
      inputs: {
        phase: 'generate_roles',
        scene_type: session.scene_type,
        game_model: session.game_model,
        source_type: session.source_type,
        psyche_mode: session.psyche_mode,
        channel: session.channel,
        title: session.title,
        scenario: session.scenario,
        role_count: roleCount,
        roles_json: '',
        history_json: '[]',
        user_input: '',
        current_round: 0,
        max_rounds: session.max_rounds,
        elapsed_minutes: 0,
        max_minutes: session.max_minutes,
        user_current_profile: userCurrentProfile || '',
      },
    });
    const parsed = parseWorkflowOutput(payload, ['round_result']);
    return normalizeRoles(parsed.roles);
  }

  async function startSession(body = {}) {
    const userId = String(body.userId || 'default-user');
    const scene_type = pickEnum(body.scene_type, SCENE_TYPES, '');
    const game_model = pickEnum(body.game_model, GAME_MODELS, '');
    const source_type = pickEnum(body.source_type, SOURCE_TYPES, 'guided_simulation');
    const psyche_mode = source_type === 'real_record'
      ? 'evidence_bound'
      : pickEnum(body.psyche_mode, PSYCHE_MODES, 'evidence_bound');
    const channel = pickEnum(body.channel, CHANNELS, 'text');
    const scenario = String(body.scenario || '').trim();
    if (!scene_type || !game_model) throw httpError(400, '缺少 scene_type 或 game_model');
    if (!scenario) throw httpError(400, '缺少场景描述');

    const max_rounds = clampInt(body.max_rounds, 1, 12, 12);
    const max_minutes = clampInt(body.max_minutes, 1, 30, 30);
    const roleCount = clampInt(body.role_count, 2, 5, 4);
    const title = String(body.title || scenario).trim().slice(0, 120) || '多人群体博弈会话';
    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const autoRoles = body.auto_roles !== false && !Array.isArray(body.roles);
    const config = {
      auto_roles: autoRoles,
      role_count: roleCount,
      channel,
    };
    const state = {
      elapsed_ms: 0,
      last_tick_at: now,
      phase: 'play',
      history_id: '',
      last_round_summary: '',
      summary: null,
      review: null,
      stop_reason: '',
    };

    db.prepare(`
      INSERT INTO game_theory_sessions (
        id, user_id, title, scene_type, game_model, source_type, scenario, psyche_mode, channel,
        status, current_round, max_rounds, max_minutes, started_at, ended_at, created_at, updated_at, config_json, state_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      title,
      scene_type,
      game_model,
      source_type,
      scenario,
      psyche_mode,
      channel,
      'draft',
      0,
      max_rounds,
      max_minutes,
      null,
      null,
      now,
      now,
      JSON.stringify(config),
      JSON.stringify(state)
    );

    const session = loadSession(sessionId, userId);
    let roles;
    try {
      if (Array.isArray(body.roles) && body.roles.length) {
        roles = normalizeRoles(body.roles);
      } else {
        roles = await generateRolesFromDify(session, roleCount, body.user_current_profile);
      }
      replaceRoles(sessionId, roles);
    } catch (err) {
      db.prepare('DELETE FROM game_theory_sessions WHERE id = ?').run(sessionId);
      throw err;
    }

    const activate = body.activate === true;
    if (activate) {
      persistState(session, { ...state, last_tick_at: now }, {
        status: 'active',
        started_at: now,
      });
      session.status = 'active';
      session.started_at = now;
    }

    return serializeSession(loadSession(sessionId, userId));
  }

  function getSession(sessionId, userId) {
    return serializeSession(loadSession(sessionId, userId));
  }

  function listSessions(userId) {
    const rows = db.prepare(`
      SELECT * FROM game_theory_sessions
      WHERE user_id = ? AND status IN ('draft', 'active', 'paused')
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(userId || 'default-user');
    return rows.map((row) => serializeSession(row));
  }

  function updateRoles(sessionId, userId, rolesInput) {
    const session = loadSession(sessionId, userId);
    if (session.status !== 'draft') throw httpError(409, '仅草稿态可编辑角色');
    const roles = normalizeRoles(rolesInput);
    replaceRoles(sessionId, roles);
    saveSessionRow(session, { updated_at: Date.now() });
    return serializeSession(loadSession(sessionId, userId));
  }

  function controlSession(sessionId, userId, action, reason) {
    const session = loadSession(sessionId, userId);
    const now = Date.now();
    const nextAction = String(action || '').trim();
    if (!CONTROL_ACTIONS.has(nextAction)) throw httpError(400, 'action 必须是 start/pause/resume/stop');
    const state = tickElapsed(session, now);

    if (nextAction === 'start' || nextAction === 'resume') {
      if (!['draft', 'paused'].includes(session.status)) throw httpError(409, '当前状态不可继续');
      if (state.phase !== 'play') throw httpError(409, '复盘开始后不可继续对局');
      const hit = limitHit(session, state);
      if (hit) throw httpError(409, limitMessage(hit, session));
      persistState(session, state, {
        status: 'active',
        started_at: session.started_at || now,
        ended_at: null,
      });
      return serializeSession(loadSession(sessionId, userId));
    }

    if (nextAction === 'pause' || nextAction === 'stop') {
      if (!['active', 'paused', 'draft'].includes(session.status)) {
        throw httpError(409, '当前状态不可停止');
      }
      state.stop_reason = STOP_REASONS.has(reason) ? reason : (nextAction === 'stop' ? 'user_stop' : 'paused');
      persistState(session, state, {
        status: 'paused',
        ended_at: now,
      });
      return serializeSession(loadSession(sessionId, userId));
    }

    throw httpError(400, '未知控制动作');
  }

  async function submitRound(sessionId, userId, input) {
    const session = loadSession(sessionId, userId);
    const now = Date.now();
    if (session.status !== 'active') throw httpError(409, '会话未在进行中');
    const state = tickElapsed(session, now);
    persistState(session, state);
    const hit = limitHit(session, state);
    if (hit) {
      state.stop_reason = hit;
      persistState(session, state, { status: 'paused', ended_at: now });
      const paused = serializeSession(loadSession(sessionId, userId));
      const err = httpError(409, limitMessage(hit, session, '，已进入暂停/复盘'));
      err.payload = paused;
      throw err;
    }

    const text = String(input?.text || '').trim();
    if (!text) throw httpError(400, '缺少本轮发言');
    const source = pickEnum(input?.source, INPUT_SOURCES, 'text');
    const roles = loadRoles(sessionId);
    const rounds = loadRounds(sessionId);
    const userProfile = String(input?.user_current_profile || '').trim();

    const payload = await runRoundWorkflow({
      userId: session.user_id,
      inputs: {
        phase: 'play_round',
        scene_type: session.scene_type,
        game_model: session.game_model,
        source_type: session.source_type,
        psyche_mode: session.psyche_mode,
        channel: session.channel,
        title: session.title,
        scenario: session.scenario,
        role_count: roles.length,
        roles_json: JSON.stringify(roles),
        history_json: JSON.stringify(rounds),
        user_input: text,
        input_source: source,
        current_round: session.current_round,
        max_rounds: session.max_rounds,
        elapsed_minutes: elapsedMinutes(state),
        max_minutes: session.max_minutes,
        user_current_profile: userProfile,
      },
    });

    const parsed = parseWorkflowOutput(payload, ['round_result']);
    const roundNo = Number(parsed.round_no) || session.current_round + 1;
    const roleReplies = Array.isArray(parsed.role_replies) ? parsed.role_replies : [];
    const lightSignals = Array.isArray(parsed.light_signals) ? parsed.light_signals : [];
    const needCheckpoint = !!parsed.need_checkpoint;

    db.prepare(`
      INSERT INTO game_theory_session_rounds
      (session_id, round_no, user_input, input_source, role_replies_json, light_signals_json, need_checkpoint, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      roundNo,
      text,
      source,
      JSON.stringify(roleReplies),
      JSON.stringify(lightSignals),
      needCheckpoint ? 1 : 0,
      now
    );

    state.last_round_summary = lightSignals[0] || '';
    const nextRound = roundNo;
    const nextSession = { ...session, current_round: nextRound, status: 'active' };
    const afterHit = limitHit(nextSession, state);
    const shouldPause = needCheckpoint || !!afterHit;
    if (shouldPause) {
      state.stop_reason = afterHit || 'paused';
    }
    persistState(session, state, {
      status: shouldPause ? 'paused' : 'active',
      current_round: nextRound,
      ended_at: shouldPause ? now : null,
    });

    return {
      round_no: roundNo,
      role_replies: roleReplies,
      light_signals: lightSignals,
      need_checkpoint: needCheckpoint || !!afterHit,
      session: serializeSession(loadSession(sessionId, userId)),
    };
  }

  async function generateSummary(sessionId, userId, body = {}) {
    const session = loadSession(sessionId, userId);
    if (!['paused', 'completed'].includes(session.status) && session.status !== 'active') {
      throw httpError(409, '请先停止或暂停会话再生成全景图');
    }
    const now = Date.now();
    const state = tickElapsed(session, now);
    if (session.status === 'active') {
      persistState(session, state, { status: 'paused', ended_at: now });
      session.status = 'paused';
    }
    const roles = loadRoles(sessionId);
    const rounds = loadRounds(sessionId);
    const payload = await runSummaryWorkflow({
      userId: session.user_id,
      inputs: {
        scene_type: session.scene_type,
        game_model: session.game_model,
        source_type: session.source_type,
        psyche_mode: session.psyche_mode,
        title: session.title,
        scenario: session.scenario,
        roles_json: JSON.stringify(roles),
        history_json: JSON.stringify(rounds),
        current_round: session.current_round,
        elapsed_minutes: elapsedMinutes(state),
        stop_reason: pickEnum(body.stop_reason || state.stop_reason, STOP_REASONS, 'user_stop'),
        user_current_profile: String(body.user_current_profile || '').trim(),
      },
    });
    const summary = parseWorkflowOutput(payload, ['summary_result']);
    state.summary = summary;
    state.phase = 'summary_ready';
    const suggestion = Array.isArray(summary.countermeasures) ? summary.countermeasures.join('；') : '';
    const causalChain = Array.isArray(summary.risk_inflections) ? summary.risk_inflections : [];
    upsertHistory(session, state, {
      suggestion,
      causalChain,
      fullResult: { session_id: session.id, summary, review: state.review },
      isSuccess: false,
    });
    persistState(session, state, { status: 'paused' });
    return {
      summary,
      session: serializeSession(loadSession(sessionId, userId)),
    };
  }

  async function generatePersonalReview(sessionId, userId, body = {}) {
    const session = loadSession(sessionId, userId);
    const state = parseState(session.state_json);
    if (!state.summary) throw httpError(409, '请先生成局势全景图');
    const roles = loadRoles(sessionId);
    const rounds = loadRounds(sessionId);
    const userRole = roles.find((role) => role.is_user) || roles[0] || {};
    const payload = await withWorkflowRetry(() => runReviewWorkflow({
      userId: session.user_id,
      inputs: {
        scene_type: session.scene_type,
        game_model: session.game_model,
        source_type: session.source_type,
        psyche_mode: session.psyche_mode,
        title: session.title,
        scenario: session.scenario,
        roles_json: JSON.stringify(roles),
        history_json: JSON.stringify(rounds),
        summary_json: JSON.stringify(state.summary),
        user_role_id: String(body.user_role_id || userRole.role_id || ''),
        user_role_name: String(body.user_role_name || userRole.name || ''),
        current_round: session.current_round,
        elapsed_minutes: elapsedMinutes(state),
        user_current_profile: String(body.user_current_profile || '').trim(),
      },
    }));
    const review = parseWorkflowOutput(payload, ['review_result']);
    state.review = review;
    state.phase = 'review_done';
    const guidance = Array.isArray(review.strategy_guidance) ? review.strategy_guidance.join('；') : '';
    const causalChain = Array.isArray(review.missed_moments)
      ? review.missed_moments.map((item) => `R${item.round_no || '?'}: ${item.issue || ''}`)
      : [];
    upsertHistory(session, state, {
      suggestion: guidance,
      causalChain,
      fullResult: { session_id: session.id, summary: state.summary, review },
      isSuccess: true,
    });
    persistState(session, state, {
      status: 'completed',
      ended_at: Date.now(),
    });
    return {
      review,
      session: serializeSession(loadSession(sessionId, userId)),
    };
  }

  return {
    startSession,
    getSession,
    listSessions,
    updateRoles,
    controlSession,
    submitRound,
    generateSummary,
    generatePersonalReview,
  };
}

module.exports = {
  initGameTheorySessionTables,
  createGameTheorySessionService,
  extractJson,
  parseWorkflowOutput,
  normalizeRoles,
  limitHit,
  elapsedMinutes,
};
