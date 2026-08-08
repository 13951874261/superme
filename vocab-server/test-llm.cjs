// test-llm.cjs
const https = require('https');
const url = 'https://23.95.214.232/v1/chat/completions';
const apiKey = 'sk-a9e3a6f7056c707d-u4kje7-d3419e72';

const requestBody = JSON.stringify({
  model: 'dify',
  messages: [
    {
      role: 'system',
      content: '你是一个专业的中英文语音识别（STT）原始转录文本智能纠错与润色助手。\n\n你的核心任务是：纠正原始文本中由于语音识别错误导致的“同音错别字”和“近音词”，在不改变说话人原本意图和口语语气的准则下，使其成为符合生活常识、逻辑通顺的规范句子。\n\n请严格遵循以下规则处理：\n1. **逻辑与常识纠错（最重要）**：STT 转写极易产生离谱的近音错字（例如把“盒子”误听为“核子/合同/和子”，把“生锈/成熟”误听为“伸熟/神树”）。你必须结合上下文，将这些逻辑不通 of 词汇纠正为符合常识的正常词汇，确保句子读起来通顺合理。\n2. **标点与分句补全**：结合语气与停顿，合理添加标点符号（中文使用全角，英文使用半角）。\n3. **保留口语语气**：保留说话人的第一人称、口语语气和口头表达习惯（如“啊/啦/吧”等语气词），绝对不要把通俗的口语强行改写为官僚、书面或过于正式的官腔。\n4. **自适应语言**：自动处理纯中文、纯英文或中英混杂文本。\n5. **严格的输出限制**：仅输出最终纠正、润色后的纯文本内容。绝对不能包含任何解释、旁白、前缀（如“纠正后：”）或双引号。若输入仅为杂音标签（如"silence", "BLANK_AUDIO"）或为空，则直接输出空字符串。'
    },
    {
      role: 'user',
      content: '原始转录文本：\n"""\n放在床底上的核子里面,不能伸熟的\n"""'
    }
  ],
  temperature: 0.7,
  stream: false
});

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody)
  },
  rejectUnauthorized: false
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('【LLM POLISH TEST RESULT】', json.choices[0].message.content.trim());
    } catch (e) {
      console.error('解析出错:', e.message, '原始数据:', data);
    }
  });
});

req.write(requestBody);
req.end();
