const fs = require('fs');
const path = require('path');

// Read the module source
const source = fs.readFileSync(path.join(__dirname, 'services/cambridgeDictionary.js'), 'utf8');

// Extract cleanMarkdown function
const match = source.match(/function cleanMarkdown\(value\) \{[\s\S]*?\n\}/);
if (match) {
  console.log('=== Module cleanMarkdown source ===');
  console.log(match[0]);
}