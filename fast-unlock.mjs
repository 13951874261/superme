const targetUrl = 'https://app.liujingzhuwo.site';
const theme = '跨部门协调：资源争夺';
const userId = 'default-user';
const today = new Date().toISOString().split('T')[0];

console.log('--------------------------------------------------');
console.log('Starting theme mastery unlock injection (using Node.js fetch)...');
console.log('Target Theme:', theme);
console.log('--------------------------------------------------');

async function run() {
  try {
    const sessionRes = await fetch(`${targetUrl}/api/training/session/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, trainingDate: today })
    }).then(r => r.json());
    
    const sessionId = sessionRes.sessionId;
    console.log('Session ID retrieved:', sessionId);

    console.log('Injecting 10 oral attempts...');
    for (let i = 1; i <= 10; i++) {
      const oralRes = await fetch(`${targetUrl}/api/training/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          moduleType: 'oral',
          sceneType: theme,
          caseText: `Oral attempt round ${i}`,
          userAnswer: { text: `Mock response ${i}` },
          durationSeconds: 15
        })
      }).then(r => r.json());
      
      if (oralRes.error) {
         console.error('Oral Error:', oralRes);
      } else {
         console.log(`-> Oral attempt ${i} added. AttemptId: ${oralRes.attemptId}`);
      }
    }

    console.log('Injecting L3 write attempt...');
    const writeRes = await fetch(`${targetUrl}/api/training/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userId,
        moduleType: 'write',
        sceneType: theme,
        caseText: 'Write report',
        userAnswer: { text: 'Regarding the resource conflict between departments, I suggest we hold a weekly alignment meeting.' },
        durationSeconds: 120,
        score: 8.5
      })
    }).then(r => r.json());
    
    console.log(`-> Write attempt added. Score: 8.5, AttemptId: ${writeRes.attemptId || writeRes.error}`);

    console.log('--------------------------------------------------');
    console.log('Verifying mastery status from server...');
    const checkRes = await fetch(`${targetUrl}/api/theme/check-mastery?theme=${encodeURIComponent(theme)}&userId=${userId}`)
      .then(r => r.json());
    
    console.log('Mastery Check Results:');
    console.log('Theme      :', checkRes.theme);
    console.log(`Oral Count : ${checkRes.oralCount} (Passed: ${checkRes.oralPassed})`);
    console.log(`Write Score: ${checkRes.maxWriteScore}`);
    
    if (checkRes.isMastered) {
      console.log('\x1b[32m%s\x1b[0m', 'STATUS     : 🎉 已通关已解锁 (UNLOCKED SUCCESSFULLY!)');
    } else {
      console.log('\x1b[31m%s\x1b[0m', 'STATUS     : ❌ 未通关 (FAILED TO UNLOCK)');
    }
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Error occurred:', err);
  }
}

run();
