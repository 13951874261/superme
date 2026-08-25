import dotenv from 'dotenv'; dotenv.config({ path: 'vocab-server/.env' });

const apiKey = process.env.DIFY_ENGLISH_MASTERY_KEY;
const baseUrl = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';

console.log('Testing Dify API:', baseUrl, 'Key prefix:', apiKey ? apiKey.slice(0, 10) + '...' : 'NONE');

async function test() {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          theme: '商务谈判: 让步与施压',
          cefr_level: 'B1',
          genre: 'negotiation',
          duration: '25',
          history_exclude: '',
          user_flaws: '',
          user_current_profile: ''
        },
        query: 'generate',
        response_mode: 'streaming',
        user: 'test-debug-user'
      })
    });
    console.log('HTTP Status:', res.status, res.statusText);
    let chunks = 0;
    let totalBytes = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`Stream done cleanly! Total chunks: ${chunks} Bytes: ${totalBytes} Elapsed: ${((Date.now()-start)/1000).toFixed(1)}s`);
        break;
      }
      chunks++;
      totalBytes += value.length;
      const text = decoder.decode(value, { stream: true });
      if (chunks <= 3 || chunks % 20 === 0) {
        console.log(`[Chunk ${chunks} ${((Date.now() - start)/1000).toFixed(1)}s] size=${value.length} sample: ${text.slice(0, 120).replace(/\n/g, ' ')}`);
      }
    }
  } catch (err) {
    console.error(`Error during test after ${((Date.now() - start)/1000).toFixed(1)}s:`, err);
  }
}
test();

