import { requireLegacyTestTarget } from '../vocab-server/tests/helpers/legacyTestTarget.cjs';
const isolatedTestTarget = requireLegacyTestTarget('database');
const Database = require('../vocab-server/node_modules/better-sqlite3');
const db = new Database(isolatedTestTarget, { readonly: true, fileMustExist: true });

const columns = db.prepare("PRAGMA table_info('vocabulary')").all();
console.log('Columns in vocabulary:', columns);
