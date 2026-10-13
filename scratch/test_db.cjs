const { requireLegacyTestTarget } = require('../vocab-server/tests/helpers/legacyTestTarget.cjs');
const isolatedTestTarget = requireLegacyTestTarget('database');

const Database = require("../vocab-server/node_modules/better-sqlite3");
const db = new Database(isolatedTestTarget, { readonly: true, fileMustExist: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type=\"table\"").all();
console.log("Tables:", tables);

