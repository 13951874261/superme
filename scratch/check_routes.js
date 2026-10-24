import fs from 'fs';
const content = fs.readFileSync('vocab-server/server.js', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, index) => {
  if (line.includes('event-stream')) {
    console.log(`${index + 1}: ${line}`);
  }
});
