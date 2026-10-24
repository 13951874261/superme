const assert = require('assert');
const { seedGameTheoryTactics } = require('../services/gameTheoryTacticsSeed');

function createTacticsDb(existing) {
  const rows = existing.map((row) => ({ ...row }));
  return {
    rows,
    prepare(sql) {
      const text = String(sql || '');
      return {
        get() {
          return { count: rows.length };
        },
        all() {
          return rows;
        },
        run(...args) {
          if (/INSERT/i.test(text)) {
            rows.push({
              id: args[0],
              user_id: args[1],
              name: args[2],
              category: args[3],
              description: args[4],
              is_custom: args[5],
              created_at: args[6]
            });
          }
        }
      };
    }
  };
}

const db = createTacticsDb([
  { id: 't1', user_id: 'system', name: '恩威并施', category: 'downward', description: '旧' }
]);
seedGameTheoryTactics(db);

const names = db.rows.map((row) => row.name);
for (const name of ['架空', '捧杀', '借刀杀人', '隔山打牛']) {
  assert.ok(names.includes(name), 'system tactics must include ' + name + ' even when old rows exist');
}

console.log('gameTheoryTacticsSeed.test.js passed');
