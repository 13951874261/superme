const fs = require('fs');

const path = 'd:/cursor/work/super-agent/vocab-server/server.js';
let content = fs.readFileSync(path, 'utf8');

const oldBlock1 = `        try {
          const parsed = JSON.parse(cleanJson);
          if (parsed.words && Array.isArray(parsed.words)) extractedItems.push(...parsed.words);
          if (parsed.phrases && Array.isArray(parsed.phrases)) extractedItems.push(...parsed.phrases);
          if (Array.isArray(parsed)) extractedItems = parsed;
        } catch (e) {`;

const newBlock1 = `        try {
          const parsed = JSON.parse(cleanJson);
          if (parsed.words && Array.isArray(parsed.words)) extractedItems.push(...parsed.words);
          if (parsed.phrases && Array.isArray(parsed.phrases)) extractedItems.push(...parsed.phrases);
          if (parsed.sentences && Array.isArray(parsed.sentences)) {
            extractedItems.push(...parsed.sentences.map(s => {
              if (typeof s === 'string') return { word: s, is_sentence: true };
              if (typeof s === 'object' && s !== null) return { ...s, is_sentence: true };
              return s;
            }));
          }
          if (Array.isArray(parsed)) extractedItems = parsed;
        } catch (e) {`;

const oldBlock2 = `        let dictType = 'ai_extracted';
        if (isObject && item.is_phrase !== undefined) {
          dictType = item.is_phrase ? 'ai_phrase' : 'ai_extracted';
        } else {
          // 启发式判断`;

const newBlock2 = `        let dictType = 'ai_extracted';
        if (isObject && item.is_sentence) {
          dictType = 'ai_sentence';
        } else if (isObject && item.is_phrase !== undefined) {
          dictType = item.is_phrase ? 'ai_phrase' : 'ai_extracted';
        } else {
          // 启发式判断`;

// Normalize line endings to avoid \r\n vs \n issues
const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(oldBlock1)) && normalize(content).includes(normalize(oldBlock2))) {
    content = normalize(content).replace(normalize(oldBlock1), newBlock1).replace(normalize(oldBlock2), newBlock2);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Success");
} else {
    console.log("Failed to find blocks");
    if (!normalize(content).includes(normalize(oldBlock1))) console.log("Missing Block 1");
    if (!normalize(content).includes(normalize(oldBlock2))) console.log("Missing Block 2");
}
