import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Paths relative to repo root — expand as each sweep task completes */
const SCOPED = process.argv.slice(2);
if (!SCOPED.length) {
  console.error('Usage: node scripts/assert-ui-cta-bans.mjs <relpath>...');
  process.exit(2);
}

const BANNED = [
  /bg-violet-600/,
  /bg-purple-600/,
  /bg-indigo-600(?!\/)/, // solid indigo primary fills
  /hover:bg-violet-500/,
  /hover:bg-indigo-700/,
  /bg-\[#00BCD4\]/,
];

let failed = false;
for (const rel of SCOPED) {
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, 'utf8');
  for (const re of BANNED) {
    if (re.test(text)) {
      console.error(`BAN hit ${re} in ${rel}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('CTA bans OK for', SCOPED.length, 'files');
