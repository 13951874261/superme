const urlValidator = require('./vocab-server/services/urlValidator');
const markdownSanitizer = require('./vocab-server/services/markdownSanitizer');
const taskQueue = require('./vocab-server/services/taskQueue');

async function testUrlValidator() {
  console.log('--- 测试 URL 安全校验 (SSRF 防御) ---');
  
  const testCases = [
    { url: 'https://www.google.com', expected: true },
    { url: 'http://127.0.0.1:3000/api', expected: false },
    { url: 'http://localhost/admin', expected: false },
    { url: 'http://192.168.1.1/router', expected: false },
    { url: 'https://10.255.255.254', expected: false }
  ];

  for (const tc of testCases) {
    try {
      const isValid = await urlValidator.validateUrl(tc.url);
      console.log(`[URL] ${tc.url} -> 验证结果: ${isValid} (期望: ${tc.expected}) - ${isValid === tc.expected ? '✅ 通过' : '❌ 失败'}`);
    } catch (err) {
      console.log(`[URL] ${tc.url} -> 抛出异常: ${err.message} (期望: ${tc.expected}) - ${!tc.expected ? '✅ 通过' : '❌ 失败'}`);
    }
  }
}

function testMarkdownSanitizer() {
  console.log('\n--- 测试 Markdown HTML/XSS 清洗 ---');
  
  const dirtyMarkdown = `
# 正常标题
这是一个段落。

<script>alert('xss')</script>
<iframe src="http://evil.com"></iframe>
<img src="x" onerror="alert(1)">

[点击链接](javascript:alert(2))
[安全链接](https://google.com)
  `;

  const clean = markdownSanitizer.sanitizeMarkdown(dirtyMarkdown);
  console.log('清洗前大小:', dirtyMarkdown.length);
  console.log('清洗后大小:', clean.length);
  
  const hasScript = clean.includes('<script>');
  const hasIframe = clean.includes('iframe');
  const hasOnerror = clean.includes('onerror');
  const hasJavascriptUrl = clean.includes('javascript:');
  const hasSafeLink = clean.includes('https://google.com');

  console.log(`XSS 标签清除测试: ${!hasScript && !hasIframe && !hasOnerror && !hasJavascriptUrl ? '✅ 通过' : '❌ 失败'}`);
  console.log(`安全链接保留测试: ${hasSafeLink ? '✅ 通过' : '❌ 失败'}`);
  console.log('--- 清洗后正文预览 ---');
  console.log(clean.trim());
}

function testTaskQueue() {
  console.log('\n--- 测试内存任务队列 (Task Queue) ---');
  
  const task = taskQueue.createTask('video', '测试音轨转写');
  console.log('创建任务成功:', task.id, '状态:', task.status);
  
  taskQueue.updateTask(task.id, { progress: 50, logs: ['音轨提取完成，准备上传...'] });
  const updatedTask = taskQueue.getTask(task.id);
  console.log('更新后状态:', updatedTask.status, '进度:', updatedTask.progress);
  console.log('日志条数:', updatedTask.logs.length);
  
  taskQueue.updateTask(task.id, { status: 'completed', result: { name: 'result.md', content: '# Results', mimeType: 'text/markdown' } });
  const finalTask = taskQueue.getTask(task.id);
  console.log('完成状态:', finalTask.status, '结果名:', finalTask.result?.name);
  console.log('--- 队列测试完成 ✅ ---');
}

async function runAll() {
  await testUrlValidator();
  testMarkdownSanitizer();
  testTaskQueue();
}

runAll().catch(console.error);
