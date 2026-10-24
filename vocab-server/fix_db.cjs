const fs = require('fs');
const file = 'D:/cursor/work/super-agent/vocab-server/server.js';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace("const PORT = process.env.PORT || 3002;", "const PORT = process.env.PORT || 3001;");

fs.writeFileSync(file, code, 'utf-8');
console.log('Fixed Port');
