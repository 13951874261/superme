const fs = require('fs');
const p = 'D:\\cursor\\work\\super-agent\\vocab-server\\server.js';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes("require('./services/prototypeArchiveGuard')")) {
  c = c.replace(
    "const { analyzeListening } = require('./services/listenAnalysisService');",
    "const { analyzeListening } = require('./services/listenAnalysisService');\nconst { normalizePrototypeArchive } = require('./services/prototypeArchiveGuard');"
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('added import');
} else {
  console.log('import already present');
}