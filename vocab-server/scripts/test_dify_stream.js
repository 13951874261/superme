
const payload = {
  inputs: {
    theme: '商务谈判：让步与施压',
    cefr_level: 'A2',
    genre: 'meeting',
    duration: '1',
    history_exclude: '',
    user_flaws: '',
    user_current_profile: '',
    _system_time: '2026-08-09 02:00:00',
    _system_timestamp_ms: Date.now()
  },
  query: 'generate',
  response_mode: 'streaming',
  user: 'lzhmy'
};

function mergeStreamAnswer(prev, next) {
  return prev + next;
}

fetch('https://dify.234124123.xyz/v1/chat-messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer app-OShKY1EcVuLFkuxrpO28ZB0A',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(async (res) => {
  console.log('Status:', res.status);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }

  const decoder = new TextDecoder();
  let sseBuffer = "";
  let answer = "";
  let streamError = "";

  const parseSSELines = (text) => {
    sseBuffer += text;
    let lineEnd = sseBuffer.indexOf('\n');
    while (lineEnd !== -1) {
      const line = sseBuffer.substring(0, lineEnd).trim();
      sseBuffer = sseBuffer.substring(lineEnd + 1);
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") {
          console.log('[SSE] DONE event received');
          break;
        }
        try {
          const parsed = JSON.parse(dataStr);
          console.log('[SSE Event]', parsed.event || parsed.status || 'unknown');
          if (parsed.event === 'error' || parsed.status === 'error') {
            streamError = parsed.message || parsed.error || JSON.stringify(parsed);
          }
          if (typeof parsed.answer === 'string' && parsed.answer) {
            answer = mergeStreamAnswer(answer, parsed.answer);
          }
        } catch (e) {
          console.log('[SSE Parse Error]', e.message, 'for line:', line);
        }
      }
      lineEnd = sseBuffer.indexOf('\n');
    }
  };

  if (res.body) {
    for await (const chunk of res.body) {
      const chunkText = decoder.decode(chunk, { stream: true });
      parseSSELines(chunkText);
    }
  }

  console.log('Final Answer Length:', answer.length);
  console.log('Final Answer preview:', answer.slice(0, 100));
  if (streamError) console.log('Stream Error:', streamError);
})
.catch(console.error);
