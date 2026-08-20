const fs = require('fs');

const content = fs.readFileSync('src/components/modules/english/tabs/DashboardTab.tsx', 'utf8');
const lines = content.split('\n');

// 简单扫描 1335 行的 `{` 和 `(` 的配对情况
let openBraceCount = 0;
let openParenCount = 0;
let targetBraceCloseLine = -1;
let targetParenCloseLine = -1;

let isTracking = false;

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i];

  if (lineNum === 1335) {
    console.log(`Line 1335: ${line}`);
    isTracking = true;
  }

  if (isTracking) {
    // 忽略字符串和注释中的括号
    // 为了简单，我们只做粗略计数，因为JSX中很多大括号，我们先看看普通字符的配对
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '{') {
        openBraceCount++;
      } else if (char === '}') {
        openBraceCount--;
        if (openBraceCount === 0 && targetBraceCloseLine === -1) {
          targetBraceCloseLine = lineNum;
        }
      } else if (char === '(') {
        openParenCount++;
      } else if (char === ')') {
        openParenCount--;
        if (openParenCount === 0 && targetParenCloseLine === -1) {
          targetParenCloseLine = lineNum;
        }
      }
    }

    if (openBraceCount === 0 && openParenCount === 0) {
      console.log(`Tracking finished at line ${lineNum}`);
      break;
    }
  }
}

console.log(`Results:`);
console.log(`Target brace close line: ${targetBraceCloseLine}`);
console.log(`Target paren close line: ${targetParenCloseLine}`);
console.log(`At the end of tracking, openBraceCount=${openBraceCount}, openParenCount=${openParenCount}`);
