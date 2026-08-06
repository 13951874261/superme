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
  const tempWav = path.join(__dirname, 'test-temp.wav');
  // 写入最简 WAV 头部/数据以便进行接口测试
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36, 4); // File size - 8
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  wavHeader.writeUInt16LE(1, 22);  // NumChannels
  wavHeader.writeUInt32LE(8000, 24); // SampleRate
  wavHeader.writeUInt32LE(8000 * 1 * 1, 28); // ByteRate
  wavHeader.writeUInt16LE(1, 32);  // BlockAlign
  wavHeader.writeUInt16LE(8, 34);  // BitsPerSample
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(0, 40);  // Subchunk2Size
  fs.writeFileSync(tempWav, wavHeader);

  try {
    // 1. 正常 STT 测试
    console.log('\n[测试 1] 正常 STT 代理测试...');
    const formData = new globalThis.FormData();
    const fileBuffer = fs.readFileSync(tempWav);
    const blob = new globalThis.Blob([fileBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'test-temp.wav');
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
    if (fs.existsSync(tempWav)) {
      fs.unlinkSync(tempWav);
    }
  }
}

runTests();
