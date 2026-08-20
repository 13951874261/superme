const keys = [
  'app-vBQMyqeHD16U0XxzUt9DdJYI',
  'app-XIdGNvsZic1AZ3I7p66nqJpb',
  'app-OShKY1EcVuLFkuxrpO28ZB0A',
  'app-jOUB4sarfRYumAyBzWhuGFYo',
  'app-TyztRkdBVX4kNUxA8dZ0frk7',
  'app-LfCGgdQrwlGTfegQNYeEzpB9'
];

const payload = {
  inputs: {
    theme: '商务谈判：让步与施压',
    cefr_level: 'B1',
    genre: 'meeting',
    duration: '1',
    history_exclude: '',
    user_flaws: '',
    user_current_profile: '',
    _system_time: '2026-08-09 02:00:00',
    _system_timestamp_ms: Date.now()
  },
  query: 'generate',
  response_mode: 'blocking',
  user: 'lzhmy'
};

async function testAll() {
  for (const key of keys) {
    try {
      const res = await fetch('https://dify.234124123.xyz/v1/chat-messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      console.log(`Key ${key} -> Status: ${res.status}`);
      if (res.status === 200) {
        console.log(`  SUCCESS! Length: ${text.length}`);
        console.log(`  Preview: ${text.slice(0, 150)}`);
      } else {
        console.log(`  FAIL: ${text}`);
      }
    } catch (e) {
      console.log(`Key ${key} -> Error: ${e.message}`);
    }
  }
}

testAll();
