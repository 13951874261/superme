/**
 * 自定义场景主题级联删除：本地库事务清理 + 可选 Dify 文档尽力删除。
 * 匹配键会排除系统预置主题名，词条仅清理 Custom Theme Extract 来源，降低误伤。
 */

/** 与前端 EnglishContext ALL_THEMES.value 对齐，删除时禁止用作级联键 */
const SYSTEM_THEME_VALUES = [
  '商务谈判：让步与施压',
  '危机公关：外媒答疑',
  '项目汇报：跨国董事会',
  '商务破冰：高管Small Talk',
  '会议主持：跨文化控场',
  '跨部门协调：资源争夺',
  '绩效反馈：员工评估',
  '商业路演：投资人汇报',
  '供应商审计：合规谈判',
  '组织重组：人事沟通',
  '跨文化社交：艺术展交流',
  '应急沟通：海外就医',
  '文化破冰：外企晚宴',
  '中日韩三方会议：跨文化破局',
  '娱乐审美：艺术讲述',
  '中东商务：跨文化禁忌',
];

const SYSTEM_THEME_SET = new Set(SYSTEM_THEME_VALUES);

function uniqNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const v of values || []) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function buildThemeMatchKeys(row, protectedKeys = SYSTEM_THEME_VALUES) {
  if (!row) return [];
  const protectedSet = new Set(
    (protectedKeys || []).map((k) => String(k || '').trim()).filter(Boolean)
  );
  return uniqNonEmpty([row.theme_name, row.display_name, row.themeName, row.displayName])
    .filter((key) => !protectedSet.has(key));
}

function isCustomThemeExtractSource(source) {
  if (typeof source !== 'string') return false;
  return /custom\s*theme\s*extract/i.test(source.trim());
}

function deleteVocabularyForThemes(db, themeKeys) {
  if (!themeKeys.length) return 0;
  const rows = db.prepare(`
    SELECT id, payload FROM vocabulary
    WHERE dict_type IN ('ai_extracted', 'ai_phrase', 'ai_sentence')
  `).all();

  const keySet = new Set(themeKeys);
  let deleted = 0;
  const del = db.prepare('DELETE FROM vocabulary WHERE id = ?');
  for (const row of rows) {
    let payload = {};
    try {
      payload = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      continue;
    }
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';
    if (!topic || !keySet.has(topic)) continue;
    // 仅删除自定义场景萃取来源，避免同名 topic 误伤日常/长文入库词
    if (!isCustomThemeExtractSource(payload.source)) continue;
    del.run(row.id);
    deleted += 1;
  }
  return deleted;
}

function deleteRowsByThemeColumn(db, table, column, themeKeys) {
  if (!themeKeys.length) return 0;
  const placeholders = themeKeys.map(() => '?').join(',');
  const result = db.prepare(
    `DELETE FROM ${table} WHERE ${column} IN (${placeholders})`
  ).run(...themeKeys);
  return result.changes || 0;
}

/**
 * @param {object} db better-sqlite3 / compatible
 * @param {{ id: string, deleteDifyDocument?: Function, protectedThemeKeys?: string[] }} options
 */
async function cascadeDeleteCustomTheme(db, options = {}) {
  const id = options.id;
  if (!id) {
    return { success: false, error: 'Missing theme id' };
  }

  const row = db.prepare('SELECT * FROM custom_themes WHERE id = ?').get(id);
  if (!row) {
    return { success: false, error: 'Custom theme not found' };
  }

  const themeKeys = buildThemeMatchKeys(row, options.protectedThemeKeys || SYSTEM_THEME_VALUES);
  const themeSnapshot = {
    id: row.id,
    userId: row.user_id,
    themeName: row.theme_name,
    displayName: row.display_name,
    associatedFile: row.associated_file,
    difyDocumentId: row.dify_document_id,
    difyDatasetId: row.dify_dataset_id,
    extractedKeywords: row.extracted_keywords,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const stats = db.transaction(() => {
    const vocabularyDeleted = deleteVocabularyForThemes(db, themeKeys);
    const generationDeleted = deleteRowsByThemeColumn(db, 'generation_history', 'theme', themeKeys);
    const attemptsDeleted = deleteRowsByThemeColumn(db, 'training_attempts', 'scene_type', themeKeys);
    const themeDeleted = db.prepare('DELETE FROM custom_themes WHERE id = ?').run(id).changes || 0;
    return {
      vocabularyDeleted,
      generationDeleted,
      attemptsDeleted,
      themeDeleted,
    };
  })();

  let dify = { ok: true, cloudCleanupIncomplete: false };
  if (row.dify_document_id && row.dify_dataset_id && typeof options.deleteDifyDocument === 'function') {
    try {
      const difyResult = await options.deleteDifyDocument({
        documentId: row.dify_document_id,
        datasetId: row.dify_dataset_id,
      });
      if (!difyResult || difyResult.ok !== true) {
        dify = {
          ok: false,
          cloudCleanupIncomplete: true,
          error: (difyResult && difyResult.error) || 'Dify delete failed',
        };
      }
    } catch (err) {
      dify = {
        ok: false,
        cloudCleanupIncomplete: true,
        error: err && err.message ? err.message : String(err),
      };
    }
  }

  return {
    success: true,
    stats,
    dify,
    themeSnapshot,
    themeKeys,
  };
}

module.exports = {
  SYSTEM_THEME_VALUES,
  SYSTEM_THEME_SET,
  buildThemeMatchKeys,
  cascadeDeleteCustomTheme,
  deleteVocabularyForThemes,
  isCustomThemeExtractSource,
};
