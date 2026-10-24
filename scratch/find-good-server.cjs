const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const commits = ['HEAD', '973c792', 'c744b27', '5f1aa5b', 'eca6b39'];
const tmpDir = os.tmpdir();

for (const c of commits) {
  const out = path.join(tmpDir, `server-${c.replace(/[^a-z0-9]/gi, '_')}.js`);
  try {
    const content = execSync(`git show ${c}:vocab-server/server.js`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    fs.writeFileSync(out, content, 'utf8');
    execSync(`node --check "${out}"`, { stdio: 'pipe' });
    console.log(`${c}: OK (${content.split(/\r?\n/).length} lines)`);
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString().split('\n').slice(0, 3).join(' | ');
    console.log(`${c}: FAIL - ${msg}`);
  }
}
