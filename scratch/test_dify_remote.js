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

fetch('https://dify.234124123.xyz/v1/chat-messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer app-XIdGNvsZic1AZ3I7p66nqJpb',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(async (res) => {
  console.log('Status:', res.status);
  console.log('Response:', await res.text());
})
.catch(console.error);
