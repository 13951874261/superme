// Aesthetics Fallback unit tests
const { normalize, sysPrompt, userPrompt } = require('../services/aestheticsFallback');

async function runTests() {
  const failures = [];

  // 1. sysPrompt must contain real Chinese
  const sys = sysPrompt();
  if (typeof sys !== 'string' || sys.trim() === '') {
    failures.push('sysPrompt() did not return a non-empty string');
  } else {
    const questionMarks = (sys.match(/\?/g) || []).length;
    const totalChars = sys.length;
    if (totalChars > 0 && questionMarks / totalChars > 0.9) {
      failures.push('sysPrompt() appears corrupted: ' + questionMarks + '/' + totalChars + ' chars are ?');
    }
    const requiredKeywords = ['社交', '礼仪', '反馈', '评分', 'JSON', '专家'];
    const found = requiredKeywords.filter(kw => sys.includes(kw));
    if (found.length < 2) {
      failures.push('sysPrompt() missing keywords, found: [' + found.join(', ') + ']');
    }
  }

  // 2. userPrompt must include scene and response
  const usr = userPrompt('政商务饭局', '我认为应该先敬酒表达诚意');
  if (typeof usr !== 'string' || usr.length < 10) {
    failures.push('userPrompt() returned invalid string');
  }
  if (!usr.includes('政商务饭局')) {
    failures.push('userPrompt() did not include scene parameter');
  }
  if (!usr.includes('我认为应该先敬酒表达诚意')) {
    failures.push('userPrompt() did not include response parameter');
  }

  // 3. normalize edge cases
  const n1 = normalize({ feedback: 'ok', score: 7, is_passed: true });
  if (n1.score !== 7 || !n1.is_passed) failures.push('normalize basic case failed: score=' + n1.score + ' passed=' + n1.is_passed);

  const n2 = normalize({});
  if (n2.score !== 0 || n2.is_passed !== false) failures.push('normalize empty object failed');

  const n3 = normalize({ feedback: '', score: -5, is_passed: false });
  if (n3.score !== 0) failures.push('normalize negative score failed');

  const n4 = normalize({ feedback: null, score: 'abc', is_passed: null });
  if (n4.score !== 0 || typeof n4.feedback !== 'string') failures.push('normalize NaN score failed');

  // Report
  if (failures.length === 0) {
    console.log('OK aestheticsFallback: all tests passed');
  } else {
    console.error('FAIL aestheticsFallback tests:');
    failures.forEach(f => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

runTests().catch(e => { console.error('Unhandled:', e); process.exitCode = 1; });