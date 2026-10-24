const fs = require('fs');
const code = fs.readFileSync('vocab-server/server.js', 'utf8');

// Extract the daily-extract route handler
// It starts at: app.post('/api/english/daily-extract'
// and ends at: app.get('/api/daily-quota/status'
const startIdx = code.indexOf("app.post('/api/english/daily-extract'");
const endIdx = code.indexOf("app.get('/api/daily-quota/status'");

if (startIdx === -1 || endIdx === -1) {
  console.log('Could not find start or end index');
  process.exit(1);
}

const routeCode = code.substring(startIdx, endIdx);
fs.writeFileSync('test.js', `
import crypto from 'crypto';
const db = {
  prepare() {
    return {
      get() {},
      run() {}
    };
  },
  transaction() {
    return () => {};
  }
};
const WORD_DAILY_LIMIT = 50;
const PHRASE_DAILY_LIMIT = 30;

${routeCode}
`);
console.log('Written test.js');
