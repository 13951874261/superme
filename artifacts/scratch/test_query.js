const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
const BASE_URL = 'https://dify.234124123.xyz/v1';

async function testQuery(word, dictType) {
  try {
    const res = await fetch(`${BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_DICT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          word: word.trim(),
          dict_type: dictType,
          direction: 'auto',
          user_context: '',
          locale: 'zh-CN'
        },
        response_mode: 'blocking',
        user: 'frontend-panel'
      })
    });

    const data = await res.json();
    console.log(`Word: ${word}, DictType: ${dictType}`);
    console.log('Response keys:', Object.keys(data));
    if (data.data && data.data.outputs) {
      console.log('Outputs result:', data.data.outputs.result);
    } else {
      console.log('No outputs data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testQuery('utilize', 'en_zh_bidirectional');
