
async function runTest() {
  try {
    const res = await fetch('http://localhost:3001/api/vocab/export-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all', currentTab: 'business' })
    });
    if (!res.ok) {
      throw new Error(`API returned HTTP ${res.status}`);
    }
    const data = await res.json();
    console.log('API Response:', data);
    
    if (!data.success || !data.taskId) {
      throw new Error('Task creation failed');
    }
    
    const taskId = data.taskId;
    console.log(`Task created with ID: ${taskId}. Starting polling...`);
    
    let attempts = 0;
    while (attempts < 20) {
      const taskRes = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
      const task = await taskRes.json();
      console.log(`[Poll #${attempts}] Status: ${task.status}, Progress: ${task.progress}%`);
      if (task.logs && task.logs.length > 0) {
        console.log('Latest log:', task.logs[task.logs.length - 1]);
      }
      
      if (task.status === 'completed') {
        console.log('Task completed successfully!');
        console.log('Result name:', task.result?.name);
        console.log('Result content (first 200 chars):');
        console.log(task.result?.content ? task.result.content.slice(0, 200) : 'null');
        break;
      }
      
      if (task.status === 'failed') {
        console.error('Task failed with error:', task.error);
        break;
      }
      
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTest();
