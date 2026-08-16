const fetch = require('node-fetch');

async function test() {
  const apiKey = 'app-Eygg39qoniWss17wjWvLUvDb';
  const baseUrl = 'https://dify.234124123.xyz/v1';

  // 1. 尝试以 Chat-Message 方式请求
  try {
    const chatRes = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          theme: 'Business Negotiation',
          cefr_level: 'B1',
          genre: 'meeting'
        },
        query: 'hello',
        response_mode: 'blocking',
        user: 'test-user'
      })
    });
    console.log('Chat Status:', chatRes.status);
    const chatData = await chatRes.json();
    console.log('Chat Response:', JSON.stringify(chatData).substring(0, 500));
  } catch (err) {
    console.error('Chat Error:', err.message);
  }

  // 2. 尝试以 Workflow 方式请求
  try {
    const wfRes = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          theme: 'Business Negotiation',
          cefr_level: 'B1',
          genre: 'meeting'
        },
        response_mode: 'blocking',
        user: 'test-user'
      })
    });
    console.log('Workflow Status:', wfRes.status);
    const wfData = await wfRes.json();
    console.log('Workflow Response:', JSON.stringify(wfData).substring(0, 500));
  } catch (err) {
    console.error('Workflow Error:', err.message);
  }
}

test();
