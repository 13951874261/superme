
const Database = require("../vocab-server/node_modules/better-sqlite3");
const db = new Database("./vocab-server/vocab.db");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type=\"table\"").all();
console.log("Tables:", tables);

