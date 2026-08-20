/**
 * 自定义场景主题级联删除：本地库事务清理 + 可选 Dify 文档尽力删除。
 */

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

function buildThemeMatchKeys(row) {
  if (!row) return [];
  return uniqNonEmpty([row.theme_name, row.display_name, row.themeName, row.displayName]);
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
    if (topic && keySet.has(topic)) {
      del.run(row.id);
      deleted += 1;
    }
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
 * @param {{ id: string, deleteDifyDocument?: (args: { documentId: string, datasetId: string }) => Promise<{ ok: boolean, error?: string }> }} options
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

  const themeKeys = buildThemeMatchKeys(row);
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
  buildThemeMatchKeys,
  cascadeDeleteCustomTheme,
  deleteVocabularyForThemes,
};
