async function diagnoseStream() {
  const word = 'antigravity';
  const dictType = 'zh_modern';
  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = 'https://dify.234124123.xyz/v1';

  console.log(`Streaming workflow run for word: "${word}", type: "${dictType}"...`);
  
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
          locale: 'zh-CN'
        },
        response_mode: 'streaming',
        user: 'diagnose-stream-script'
      })
    });

    if (!response.body) {
      console.error('No response body for streaming');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith('data:')) {
          try {
            const dataStr = line.slice(5).trim();
            const data = JSON.parse(dataStr);
            
            // Print interesting events
            if (data.event === 'node_finished') {
              console.log(`\n=== Node Finished: ${data.data.title} (${data.data.node_type}) ===`);
              if (data.data.outputs) {
                console.log('Outputs:', JSON.stringify(data.data.outputs, null, 2));
              }
            } else if (data.event === 'workflow_finished') {
              console.log(`\n=== Workflow Finished ===`);
              console.log('Final Outputs:', JSON.stringify(data.data.outputs, null, 2));
            } else {
              // Log other event types briefly
              console.log(`Event: ${data.event}`);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during streaming fetch:', error);
  }
}

diagnoseStream();
