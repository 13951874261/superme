const fs = require('fs');
const path = require('path');

async function test() {
  const filePath = path.resolve(__dirname, '../test2.mp3');
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: 'audio/mp3' });
  
  const formData = new FormData();
  formData.append('file', blob, 'test2.mp3');
  formData.append('model', 'openai/whisper-1');
  formData.append('response_format', 'json');
  
  console.log('Sending request to https://9router.234124123.xyz/v1/audio/transcriptions ...');
  try {
    const response = await fetch('https://9router.234124123.xyz/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313',
      },
      body: formData,
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error during fetch:', err);
  }
}

test();
