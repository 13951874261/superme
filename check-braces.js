const fs = require('fs');
const code = fs.readFileSync('vocab-server/server.js', 'utf8');

let line = 1;
let stack = [];
let inString = false;
let quoteChar = null;
let inComment = false;
let inMultilineComment = false;

for (let i = 0; i < code.length; i++) {
  const char = code[i];
  
  if (char === '\n') {
    line++;
  }

  // Handle comments
  if (inComment) {
    if (char === '\n') {
      inComment = false;
    }
    continue;
  }

  if (inMultilineComment) {
    if (char === '*' && code[i + 1] === '/') {
      inMultilineComment = false;
      i++;
    }
    continue;
  }

  if (inString) {
    if (char === '\\') {
      // Skip next char (escaped char)
      i++;
      if (code[i] === '\n') line++;
      continue;
    }
    if (char === quoteChar) {
      inString = false;
      quoteChar = null;
    }
    continue;
  }

  // Check comment start
  if (char === '/' && code[i + 1] === '/') {
    inComment = true;
    i++;
    continue;
  }

  if (char === '/' && code[i + 1] === '*') {
    inMultilineComment = true;
    i++;
    continue;
  }

  // Check string start
  if (char === '"' || char === "'" || char === '`') {
    inString = true;
    quoteChar = char;
    continue;
  }

  // Track braces
  if (char === '{') {
    stack.push({ line, index: i });
  } else if (char === '}') {
    if (stack.length === 0) {
      console.log(`Extra } found at line ${line}`);
    } else {
      const popped = stack.pop();
      // Print match logs around our region of interest
      if (line >= 820 && line <= 1260) {
        console.log(`Matched { at line ${popped.line} with } at line ${line}`);
      }
    }
  }
}

console.log(`Remaining open braces count: ${stack.length}`);
if (stack.length > 0) {
  console.log('Unclosed braces (showing first 10):');
  stack.slice(0, 10).forEach(item => {
    console.log(`  { at line ${item.line}`);
  });
}
