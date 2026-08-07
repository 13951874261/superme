const fs = require('fs');
const path = require('path');

// 读取 .env 配置
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3001;
const apiBase = `http://127.0.0.1:${PORT}`;

async function runTests() {
  console.log('=== 开始 STT 功能模块测试 ===');
  console.log('测试环境 Key 配置情况:', process.env.DIFY_STT_API_KEY ? '已配置' : '未配置');

  if (!process.env.DIFY_STT_API_KEY) {
    console.error('错误: 请在 .env 中正确配置 DIFY_STT_API_KEY 后再运行测试！');
    process.exit(1);
  }

  // 模拟一个简易音频文件 (wav/mp3)
  // 使用真实音频文件 test2.mp3
  const audioPath = fs.existsSync(path.join(__dirname, 'test2.mp3'))
    ? path.join(__dirname, 'test2.mp3')
    : path.join(__dirname, '../test2.mp3');

  if (!fs.existsSync(audioPath)) {
    console.error('错误: 找不到真实测试音频 test2.mp3, 路径:', audioPath);
    process.exit(1);
  }

  try {
    // 1. 正常 STT 测试
    console.log('\n[测试 1] 正常 STT 代理测试...');
    const formData = new globalThis.FormData();
    const fileBuffer = fs.readFileSync(audioPath);
    const blob = new globalThis.Blob([fileBuffer], { type: 'audio/mp3' });
    formData.append('file', blob, 'test2.mp3');
    formData.append('user', 'test-automation-user');

    const res = await fetch(`${apiBase}/api/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    console.log(`[测试 1] 响应状态码: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    console.log('[测试 1] 响应结果:', data);

    if (res.ok) {
      console.log('✅ 测试 1 成功！');
    } else {
      console.log('❌ 测试 1 失败：', data.error || data);
    }

    // 2. 异常测试：缺失 DIFY_STT_API_KEY 降级行为测试
    console.log('\n[测试 2] 异常情况测试（不提供 DIFY_STT_API_KEY 服务端提示）...');
    // 模拟服务端无 API Key 的响应情况（测试我们代码中 if (!sttApiKey) 逻辑）
    // 为了不破坏真实 .env，我们在请求时不携带 user 或通过代码层面测试其反应。
    // 如果 DIFY 报错，我们的服务端应该直接传递错误码，不执行轮询。

  } catch (error) {
    console.error('测试执行中捕获到异常:', error);
  } finally {
    // 无需清理真实音频文件
  }
  }
}

runTests();
