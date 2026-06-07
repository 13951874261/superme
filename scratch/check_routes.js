import fs from 'fs';
const content = fs.readFileSync('vocab-server/server.js', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, index) => {
  if (line.includes('/api/tts') || line.includes('speech') || line.includes('/speech')) {
    console.log(`${index + 1}: ${line}`);
  }
});
