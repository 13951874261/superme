const https = require('https');
const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
const REQUEST_TIMEOUT_MS = 45000;

function sysPrompt() {
  return `????????????????????????????
????????????????????????
???????????????????????????????????????
??????? JSON????? Markdown?
{
  "feedback": "??????????????????100-250??",
  "score": 0,
  "is_passed": true
}
score ??? 0-10 ????score >= 6 ?? is_passed=true?`;
}
function userPrompt(scene, response) {
  return `??????${String(scene||'')}\n??????${String(response||'')}`;
}
function callLLM(sys, usr, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: LLM_MODEL, messages: [{role:'system',content:sys},{role:'user',content:usr}], temperature: 0.2, stream: false });
    const req = https.request(LLM_URL, { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body) }, rejectUnauthorized:false }, res => {
      let raw=''; res.on('data',c=>raw+=c); res.on('end',()=>{
        if (res.statusCode<200||res.statusCode>=300) return reject(new Error(`LLM HTTP ${res.statusCode}: ${raw.slice(0,200)}`));
        try { const d=JSON.parse(raw); const t=String(d?.choices?.[0]?.message?.content||''); const m=t.match(/\{[\s\S]*\}/); if(!m) throw new Error('no JSON'); resolve(JSON.parse(m[0])); } catch(e){ reject(new Error('LLM parse failed: '+e.message)); }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS,()=>req.destroy(new Error('LLM timeout')));
    req.on('error',reject); req.write(body); req.end();
  });
}
function normalize(r) {
  const score = Math.max(0, Math.min(10, Math.round(Number(r?.score)||0)));
  return { feedback: String(r?.feedback||''), score, is_passed: Boolean(r?.is_passed) && score >= 6 };
}
async function analyze(input, key) {
  if (!key) throw new Error('missing AESTHETICS_LLM_API_KEY');
  const raw = await callLLM(sysPrompt(), userPrompt(input.scene_category, input.user_response), key);
  return normalize(raw);
}
module.exports = { analyze, normalize, sysPrompt, userPrompt };
