require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Database = require('better-sqlite3');
const path = require('path');
const svc = require('../services/oralOpeningCacheService');

const userId = process.argv[2] || 'lzhmy';
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../vocab.db');
const db = new Database(dbPath);

svc.runDailyOralOpeningCronJob(db, { userId })
  .then((summary) => {
    console.log(JSON.stringify(summary));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
