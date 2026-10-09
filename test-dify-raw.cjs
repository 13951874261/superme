const process = require('process');

async function test() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const apiKey = 'app-OShKY1EcVuLFkuxrpO28ZB0A';
  const baseUrl = 'https://dify.234124123.xyz/v1';

  console.log("Calling Dify raw stream with 60s timeout...");
  try {
    const res = await fetch(`${baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          theme: "商务谈判：让步与施压",
          cefr_level: "B1",
          genre: "reading",
          duration: "1",
          history_exclude: "",
          user_flaws: "",
          user_current_profile: "",
        },
        query: "generate",
        response_mode: "streaming",
        user: "lzhmy",
      }),
    });

    if (!res.ok) {
      console.log("HTTP Error:", res.status, await res.text());
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            console.log("\n[DONE]");
            continue;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.event === 'message' && parsed.answer) {
              process.stdout.write(parsed.answer);
              accumulated += parsed.answer;
            } else if (parsed.event === 'error') {
              console.log("\nError event:", parsed);
            }
          } catch (e) {
            // ignore JSON parse errors
          }
        }
      }
    }
    console.log("\n-------------------------");
    console.log("Total accumulated length:", accumulated.length);
    console.log("Contains VOCAB_JSON_START:", accumulated.includes('---VOCAB_JSON_START---'));
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
