const assert = require('assert');
const { createService } = require('../services/aestheticsPushService');

function createMemoryDb() {
  const tables = new Map();
  const indexes = new Set();

  function ensureTable(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  }

  function createTableSql(sql) {
    const m = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    if (m) ensureTable(m[1]);
    return { run() {} };
  }

  function createIndexSql(sql) {
    const m = sql.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    if (m) indexes.add(m[1]);
    return { run() {} };
  }

  function prepare(sql) {
    const sel = sql.match(/SELECT\s+.*?\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
    const ins = sql.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)/i);
    const del = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);

    if (sel) {
      const tableName = sel[1];
      const isCount = /COUNT\s*\(/i.test(sql);
      return {
        get(...args) {
          const table = ensureTable(tableName);
          if (isCount) {
            let count = 0;
            for (const row of table.values()) {
              if (row.user_id === args[0]) count++;
            }
            return { count };
          }
          const [userId, pushDate] = args;
          if (pushDate) return table.get(userId + ':' + pushDate) || undefined;
          for (const row of table.values()) {
            if (row.user_id === userId) return row;
          }
          return undefined;
        },
        all(...args) {
          const table = ensureTable(tableName);
          const [userId] = args;
          const rows = [];
          for (const row of table.values()) {
            if (row.user_id === userId) rows.push(row);
          }
          return rows;
        }
      };
    }

    if (ins) {
      const tableName = ins[1];
      return {
        run(...args) {
          const [id, userId, pushDate, scenarioJson, createdAt] = args;
          const table = ensureTable(tableName);
          table.set(id, { id, user_id: userId, push_date: pushDate, scenario_json: scenarioJson, created_at: createdAt });
        }
      };
    }

    if (del) {
      const tableName = del[1];
      return {
        run(...args) {
          const [userId, pushDate] = args;
          const table = ensureTable(tableName);
          table.delete(userId + ':' + pushDate);
        }
      };
    }

    return { run() {}, get() { return undefined; }, all() { return []; } };
  }

  return { prepare, close() {} };
}

async function main() {
  const db = createMemoryDb();
  const service = createService({ db, apiKey: 'invalid-test-key', baseUrl: 'http://127.0.0.1:1' });

  const first = await service.getDailyPush({ userId: 'test-user' });
  assert.equal(first.source, 'fallback');
  assert.ok(first.title);
  assert.ok(Array.isArray(first.rules));
  assert.ok(Array.isArray(first.traps));
  assert.ok(first.rules.length >= 5, 'rules should have at least 5 scene-specific items');
  assert.ok(first.traps.length >= 5, 'traps should have at least 5 scene-specific items');
  assert.ok(first.background && first.background.length >= 20, 'background should be present');
  assert.ok(first.temper && first.temper.length >= 20, 'temper should be present');
  assert.ok(first.dialogue_example && first.dialogue_example.length >= 10, 'dialogue_example should be present');
  assert.ok(first.practice_task && first.practice_task.length >= 10, 'practice_task should be present');

  const second = await service.getDailyPush({ userId: 'test-user' });
  assert.equal(second.source, 'fallback');
  assert.notEqual(second.dedupe_key, first.dedupe_key, 'each visit must return a different scenario');
  assert.notDeepEqual(second.rules, first.rules, 'practical points must change with the scenario');

  const third = await service.getDailyPush({ userId: 'test-user' });
  assert.notEqual(third.dedupe_key, second.dedupe_key);
  assert.notEqual(third.dedupe_key, first.dedupe_key);

  const rowCount = db.prepare('SELECT COUNT(*) AS count FROM daily_aesthetics_pushes WHERE user_id = ?').get('test-user').count;
  assert.ok(rowCount >= 3, 'each visit should be stored for dedupe history');

console.log('aestheticsPush.test.js passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
