const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'vocab-server', 'server.js');
const lines = fs.readFileSync(serverPath, 'utf8').split(/\r?\n/);

lines[411] =
  "      error: `9router response format error (HTTP ${response.status}): ${rawText.substring(0, 200) || 'unable to read raw response body'}`";

if (lines[4035] && lines[4035].includes('originalname')) {
  lines[4035] =
    "    const taskName = url ? `Web video: ${url}` : `Uploaded video: ${file.originalname || 'unnamed'}`;";
}

fs.writeFileSync(serverPath, lines.join('\n'), 'utf8');
console.log('Patched server.js lines 412 and 4036');
