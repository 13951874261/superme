const fs = require('fs');

const fallbackCode = `// 当 Dify 工作流提取词汇为空时，调用本地 LLM 动态提取生词、短语与句型 (使用 dify 模型)
async function extractVocabFallback(body, cefrLevel = 'B1', genre = 'meeting', duration = '15', theme = '') {
  return new Promise((resolve) => {
    const https = require('https');
    const url = 'https://23.95.214.232/v1/chat/completions';
    const apiKey = 'sk-a9e3a6f7056c707d-u4kje7-d3419e72';

    const systemPrompt = \`You are a senior business English pedagogy expert. Read the English article provided below and extract key business vocabulary words, business phrases, and key business sentence structures.

【TARGET CEFR LEVEL】
\${cefrLevel}

【EXTRACTION REQUIREMENTS】
Based on the length of the input article and the target CEFR level, dynamically determine the number of items to extract (e.g. for a short 1-minute article, extract around 5-8 words, 3-5 phrases, and 1-2 sentence structures; for longer articles, extract more but no more than 30 words, 20 phrases, and 8 sentence structures). All extracted items must be present in the input article.

For each word/phrase/sentence structure, provide:
- phonetic: IPA notation (American standard or British standard)
- partOfSpeech: part of speech (for words only, e.g. adj. / n. / v. / adv.)
- meaning: concise Chinese meaning
- definition_en: concise English definition/explanation
- examples: an array containing the exact original sentence from the article that contains the word/phrase/sentence structure.

【OUTPUT FORMAT】
Output ONLY a single valid JSON object. Do not wrap it in markdown code blocks like \\\`\\\`\\\`json ... \\\`\\\`\\\`, and do not include any extra text.
The JSON schema must be exactly:
{
  "words": [
    {
      "word": "word",
      "phonetic": "phonetic",
      "partOfSpeech": "partOfSpeech",
      "meaning": "中文意译",
      "definition_en": "English definition",
      "examples": ["exact original sentence from article"]
    }
  ],
  "phrases": [
    {
      "phrase": "phrase",
      "meaning": "中文意译",
      "definition_en": "English definition",
      "examples": ["exact original sentence from article"]
    }
  ],
  "sentences": [
    {
      "sentence": "the full sentence structure",
      "meaning": "中文句子翻译和句型分析",
      "definition_en": "English grammar/structure explanation",
      "examples": ["exact original sentence from article"]
    }
  ]
}\`;

    const requestBody = JSON.stringify({
      model: 'dify',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: \`Input Article:\\n"""\\n\${body}\\n"""\`
        }
      ],
      temperature: 0.2,
      stream: false
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      rejectUnauthorized: false
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            const content = json.choices[0].message.content.trim();
            let clean = content;
            if (clean.toLowerCase().startsWith('\`\`\`json')) clean = clean.slice(7);
            else if (clean.startsWith('\`\`\`')) clean = clean.slice(3);
            if (clean.endsWith('\`\`\`')) clean = clean.slice(0, -3);
            clean = clean.trim();

            const parsed = JSON.parse(clean);
            resolve({
              vocab: parsed.words || parsed.vocab || [],
              phrases: parsed.phrases || [],
              sentences: parsed.sentences || []
            });
          } catch (e) {
            console.error('[Vocab Fallback] Parse error:', e.message, data);
            resolve({ vocab: [], phrases: [], sentences: [] });
          }
        } else {
          console.error('[Vocab Fallback] LLM status error:', res.statusCode, data);
          resolve({ vocab: [], phrases: [], sentences: [] });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Vocab Fallback] Request error:', err.message);
      resolve({ vocab: [], phrases: [], sentences: [] });
    });

    req.write(requestBody);
    req.end();
  });
}`;

let fileContent = fs.readFileSync('vocab-server/server.js', 'utf8');
const target = 'async function callPolishLLM(rawText)';
if (!fileContent.includes(target)) {
  console.error('Error: callPolishLLM target signature not found in server.js');
  process.exit(1);
}

// 检查是否已经存在该函数以防重复插入
if (fileContent.includes('async function extractVocabFallback')) {
  console.log('extractVocabFallback is already present.');
  process.exit(0);
}

// 在 callPolishLLM 之前插入函数，注意保留空行
const replacement = fallbackCode + '\n\n' + target;
fileContent = fileContent.replace(target, replacement);

fs.writeFileSync('vocab-server/server.js', fileContent, 'utf8');
console.log('Successfully inserted extractVocabFallback.');
