async function diagnose() {
  const word = 'utilize';
  const dictType = 'en_zh_bidirectional';
  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = 'https://dify.234124123.xyz/v1';

  console.log(`Sending request to ${BASE_URL}/workflows/run for word: "${word}", type: "${dictType}"...`);
  
  try {
    const response = await fetch(`${BASE_URL}/workflows/run`, {
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
          locale: 'zh-CN',
          _system_time: new Date().toISOString(),
          _system_timestamp_ms: Date.now()
        },
        response_mode: 'blocking',
        user: 'diagnose-script'
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log('Response JSON:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

diagnose();
