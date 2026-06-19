const http = require('http');

const testGrammarPolish = async () => {
  console.log("=====================================");
  console.log("测试开始: 语法润色 API (Workflow 模式)");
  console.log("=====================================\n");

  const postData = JSON.stringify({
    originalText: 'i will do it aging',
    userId: 'test-user-123'
  });

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/grammar-polish',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    res.setEncoding('utf8');
    let rawData = '';

    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
      console.log('\n响应内容:');
      try {
        const parsedData = JSON.parse(rawData);
        console.log(JSON.stringify(parsedData, null, 2));

        if (res.statusCode === 200 && parsedData.success) {
            console.log('\n✅ 测试通过：接口返回了状态码 200，并成功拿到了润色结果。');
        } else {
            console.log(`\n❌ 测试失败：返回状态不正常。`);
        }
      } catch (e) {
        console.error('响应体不是有效的 JSON：', rawData);
        console.log(`\n❌ 测试失败：无法解析响应体。`);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`\n请求遇到问题: ${e.message}`);
    console.log(`\n❌ 测试失败：可能是服务未启动，请先运行服务端 (cd vocab-server && node server.js)。`);
  });

  req.write(postData);
  req.end();
};

testGrammarPolish();
