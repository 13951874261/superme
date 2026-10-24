const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace the @theme block content with the new brand colors
css = css.replace(/--color-brand:[\s\S]*?--font-serif:/m, 
`--color-brand: #202124;
  --color-brand-light: #3A3B3C;
  --color-brand-dark: #0F1115;
  --color-accent: #FF5722;
  
  /* 中性色 */
  --color-canvas: oklch(98% 0 0);
  --color-surface: oklch(100% 0 0);
  --color-ink-primary: #202124;
  --color-ink-secondary: #5F6368;
  --color-ink-muted: #9AA0A6;
  --color-border: #E8EAED;
  
  /* 功能�?*/
  --color-success: #34A853;
  --color-warning: #FBBC05;
  --color-danger: #EA4335;
  --color-info: #4285F4;
  
  /* 轨道�?*/
  --color-track-orange: #FF5722;
  --color-track-indigo: #4285F4;
  
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-serif:`);

fs.writeFileSync(cssPath, css);
console.log('index.css updated');
