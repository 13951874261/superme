const fs = require('fs');
const file = 'D:/cursor/work/super-agent/vocab-server/server.js';
let code = fs.readFileSync(file, 'utf-8');

const regex = /app\.post\('\/api\/tts\/speech', async \(req, res\) => \{[\s\S]*?\}\);/;

const newStr = "app.post('/api/tts/speech', async (req, res) => {\\n" +
"  const { model, input } = req.body;\\n" +
"  \\n" +
"  if (!model || !input) {\\n" +
"    return res.status(400).json({ success: false, error: 'Missing model or input' });\\n" +
"  }\\n" +
"\\n" +
"  const TTS_API_URL = 'https://9router.234124123.xyz/v1/audio/speech';\\n" +
"  const TTS_API_KEY = 'sk-a9e3a6f7056c707d-u4kje7-d3419e72';\\n" +
"\\n" +
"  // 按句号、问号、感叹号、换行符等进行分段，防止单次请求过长导致超时或502\\n" +
"  function chunkText(text, maxLength = 800) {\\n" +
"    const chunks = [];\\n" +
"    let currentChunk = '';\\n" +
"    // 按句子分隔，保留分隔符\\n" +
"    const sentences = text.match(/[^.!?\\\\n]+[.!?\\\\n]*/g) || [text];\\n" +
"    \\n" +
"    for (let sentence of sentences) {\\n" +
"      if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {\\n" +
"        chunks.push(currentChunk.trim());\\n" +
"        currentChunk = '';\\n" +
"      }\\n" +
"      currentChunk += sentence;\\n" +
"    }\\n" +
"    if (currentChunk.trim()) {\\n" +
"      chunks.push(currentChunk.trim());\\n" +
"    }\\n" +
"    return chunks;\\n" +
"  }\\n" +
"\\n" +
"  try {\\n" +
"    const textChunks = chunkText(input);\\n" +
"    const buffers = [];\\n" +
"\\n" +
"    // 考虑到并发请求可能触发速率限制，这里使用串行请求。\\n" +
"    for (const chunk of textChunks) {\\n" +
"      if (!chunk) continue;\\n" +
"      \\n" +
"      const response = await fetch(TTS_API_URL, {\\n" +
"        method: 'POST',\\n" +
"        headers: {\\n" +
"          'Content-Type': 'application/json',\\n" +
"          'Authorization': Bearer \\\n" +
"        },\\n" +
"        body: JSON.stringify({ model, input: chunk })\\n" +
"      });\\n" +
"\\n" +
"      if (!response.ok) {\\n" +
"        throw new Error(TTS API returned \ for chunk);\\n" +
"      }\\n" +
"\\n" +
"      const blob = await response.blob();\\n" +
"      const buffer = await blob.arrayBuffer();\\n" +
"      buffers.push(Buffer.from(buffer));\\n" +
"    }\\n" +
"\\n" +
"    const finalBuffer = Buffer.concat(buffers);\\n" +
"    res.setHeader('Content-Type', 'audio/mpeg');\\n" +
"    res.send(finalBuffer);\\n" +
"  } catch (error) {\\n" +
"    console.error('[TTS Proxy Error]:', error);\\n" +
"    res.status(500).json({ success: false, error: error.message });\\n" +
"  }\\n" +
"});";

code = code.replace(regex, newStr);
code = code.replace(regex, ""); // 删掉不小心重复替换的部分
fs.writeFileSync(file, code, 'utf-8');
console.log('Patched');
