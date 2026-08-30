/**
 * 账号隔离的 localStorage 读写。
 * 学习态键必须走本模块；偏好键保持整机共用（不分桶）。
 * 禁止回退到无前缀全局学习键（不自动迁移旧全局键）。
 */

export const LEARN_KEY_PREFIX = 'sa_learn:';

/** 学习态逻辑名（不含账号前缀） */
export const LEARNING_LOGICAL_KEYS = [
  'User_Current_Profile',
  'user_current_profile',
  'user_memory_layers',
  'user_error_ledger',
  'user_profile_server_updated_at',
  'superme_biweekly_review_history',
  'superme_last_review_date',
  'superme_next_week_push',
  'superme_difficulty_adjustment',
  'superme_paused_modules',
  'superme_weekly_history_enhanced',
  'user_weakness_log',
  'write_benchmark_text',
  'write_daily_feedback',
  'super_agent_last_generated_article',
  'super_agent_last_generated_words',
  'super_agent_last_generated_phrases',
  'super_agent_last_generated_sentences',
  'super_agent_material_article',
  'super_agent_material_words',
  'super_agent_material_phrases',
  'super_agent_material_sentences',
  'super_agent_material_source',
  'super_agent_intel_source',
  'english_stage',
  'english_theme',
  'super_agent_pending_debt',
  'oral_conversation_context',
  'superme_session_memory',
  'oral_combat_points',
  'oral_sandbox_xp',
  'read_module_today_summary',
  'superme_write_context',
] as const;

export type LearningLogicalKey = (typeof LEARNING_LOGICAL_KEYS)[number];

/** 换号时清空（不上云）的会话类键 */
export const CLEAR_ON_SWITCH_KEYS = [
  'oral_conversation_context',
  'superme_session_memory',
  'oral_combat_points',
  'oral_sandbox_xp',
  'dify_embed_input_overrides',
] as const;

/** 整机共用偏好键（不分桶） */
export const PREFERENCE_KEYS = [
  'super_agent_bg_enabled',
  'super_agent_bg_index',
  'super_agent_bg_blur',
  'super_agent_bg_opacity',
  'super_agent_global_rate',
  'super_agent_global_diff',
  'super_agent_global_interceptor',
  'super_agent_default_voice',
  'super_agent_accent_pref',
  'super_agent_sound_enabled',
  'super_agent_sound_volume',
] as const;

const LEARNING_SET = new Set<string>(LEARNING_LOGICAL_KEYS);
const PREFERENCE_SET = new Set<string>(PREFERENCE_KEYS);

export function isLearningLogicalKey(name: string): name is LearningLogicalKey {
  return LEARNING_SET.has(name);
}

export function isPreferenceKey(name: string): boolean {
  return PREFERENCE_SET.has(name);
}

export function learnKey(userId: string, logicalName: string): string {
  const uid = String(userId || '').trim() || 'default-user';
  return `${LEARN_KEY_PREFIX}${uid}:${logicalName}`;
}

function assertLearningKey(logicalName: string): void {
  if (!isLearningLogicalKey(logicalName)) {
    throw new Error(`[accountStorage] unregistered learning key: ${logicalName}`);
  }
}

export function getLearnItem(userId: string, logicalName: string): string | null {
  assertLearningKey(logicalName);
  return localStorage.getItem(learnKey(userId, logicalName));
}

export function setLearnItem(userId: string, logicalName: string, value: string): void {
  assertLearningKey(logicalName);
  localStorage.setItem(learnKey(userId, logicalName), value);
}

export function removeLearnItem(userId: string, logicalName: string): void {
  assertLearningKey(logicalName);
  localStorage.removeItem(learnKey(userId, logicalName));
}

/** 偏好：原样读写，不分桶 */
export function getPreferenceItem(logicalName: string): string | null {
  if (!isPreferenceKey(logicalName)) {
    throw new Error(`[accountStorage] unregistered preference key: ${logicalName}`);
  }
  return localStorage.getItem(logicalName);
}

export function setPreferenceItem(logicalName: string, value: string): void {
  if (!isPreferenceKey(logicalName)) {
    throw new Error(`[accountStorage] unregistered preference key: ${logicalName}`);
  }
  localStorage.setItem(logicalName, value);
}

/**
 * U12：在指定账号上下文读画像原料。
 * 只读分桶键；即使无前缀全局键仍有他账号内容，也返回空。
 */
export function getStoredProfileRawForUser(userId: string): string {
  return (
    getLearnItem(userId, 'User_Current_Profile') ||
    getLearnItem(userId, 'user_current_profile') ||
    ''
  );
}

export function writeProfileLocalForUser(userId: string, profile: string, updatedAt?: number): void {
  setLearnItem(userId, 'user_current_profile', profile);
  setLearnItem(userId, 'User_Current_Profile', profile);
  if (updatedAt != null) {
    setLearnItem(userId, 'user_profile_server_updated_at', String(updatedAt));
  }
}

/** 换号时清空会话类本地态（不上云） */
export function clearSessionKeysOnSwitch(userId: string): void {
  for (const key of CLEAR_ON_SWITCH_KEYS) {
    if (isLearningLogicalKey(key)) {
      removeLearnItem(userId, key);
    } else {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }
  // embed 覆盖键是全局名，换号直接清空整机该键（避免重挂打开上一账号对话）
  try {
    localStorage.removeItem('dify_embed_input_overrides');
  } catch {
    /* ignore */
  }
}
