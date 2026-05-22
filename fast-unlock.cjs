const https = require('https');
const http = require('http');

const baseUrl = 'http://127.0.0.1:3001'; // 使用本地端口或远程域名
// 因为我们只是测试，可以直接用远程域名
const targetUrl = 'https://app.liujingzhuwo.site';

async function request(path, options = {}) {
  const url = `${targetUrl}${path}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  const theme = '跨部门协调：资源争夺';
  const userId = 'default-user';
  const today = new Date().toISOString().split('T')[0];

  console.log('--------------------------------------------------');
  console.log('Starting theme mastery unlock injection...');
  console.log('Target Theme:', theme);
  console.log('--------------------------------------------------');

  try {
    const sessionRes = await request('/api/training/session/upsert', {
      method: 'POST',
      body: { userId, trainingDate: today }
    });
    const sessionId = sessionRes.sessionId;
    console.log('Session ID retrieved:', sessionId);

    console.log('Injecting 10 oral attempts...');
    for (let i = 1; i <= 10; i++) {
      const oralRes = await request('/api/training/attempt', {
        method: 'POST',
        body: {
          sessionId,
          userId,
          moduleType: 'oral',
          sceneType: theme,
          caseText: `Oral attempt round ${i}`,
          userAnswer: { text: `Mock response ${i}` },
          durationSeconds: 15
        }
      });
      if (oralRes.error) {
         console.error('Oral Error:', oralRes);
      } else {
         console.log(`-> Oral attempt ${i} added. AttemptId: ${oralRes.attemptId}`);
      }
    }

    console.log('Injecting L3 write attempt...');
    const writeRes = await request('/api/training/attempt', {
      method: 'POST',
      body: {
        sessionId,
        userId,
        moduleType: 'write',
        sceneType: theme,
        caseText: 'Write report',
        userAnswer: { text: 'Regarding the resource conflict between departments, I suggest we hold a weekly alignment meeting.' },
        durationSeconds: 120,
        score: 8.5
      }
    });
    console.log(`-> Write attempt added. Score: 8.5, AttemptId: ${writeRes.attemptId}`);

    console.log('--------------------------------------------------');
    console.log('Verifying mastery status from server...');
    const checkRes = await request(`/api/theme/check-mastery?theme=${encodeURIComponent(theme)}&userId=${userId}`);
    
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
