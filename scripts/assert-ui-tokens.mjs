import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

const required = [
  '--color-brand:',
  '--color-brand-light:',
  '--color-brand-dark:',
  '--color-brand-hover:',
  '--color-accent:',
  '--color-border:',
  '--color-success:',
  '--color-warning:',
  '--color-danger:',
  '--color-info:',
];

const missing = required.filter((token) => !css.includes(token));
if (missing.length) {
  console.error('Missing UI tokens:', missing.join(', '));
  process.exit(1);
}
console.log('UI tokens OK');
