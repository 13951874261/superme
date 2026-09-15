const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const Database = require('better-sqlite3');
const { initBookCore, createBookRouter } = require('../services/bookService');
const { createBookExerciseService } = require('../services/bookExerciseService');

async function fixture({ evaluate, transcribe } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-exercise-'));
  const db = new Database(path.join(root, 'db'));
  db.exec(`CREATE TABLE training_sessions (id TEXT PRIMARY KEY,user_id TEXT,training_date TEXT,total_minutes INTEGER DEFAULT 0,listen_minutes INTEGER DEFAULT 0,logic_minutes INTEGER DEFAULT 0,extra_json TEXT DEFAULT '{}',created_at INTEGER,updated_at INTEGER,UNIQUE(user_id,training_date));
    CREATE TABLE training_attempts (id TEXT PRIMARY KEY,session_id TEXT,user_id TEXT,module_type TEXT,scene_type TEXT,case_text TEXT,user_answer TEXT,duration_seconds INTEGER,score REAL,created_at INTEGER);`);
  initBookCore(db);
  const now = Date.now();
  db.prepare("INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,active_framework_revision_id,created_at,updated_at) VALUES ('b','alice','书','a.txt','ready','br','fr',?,?)").run(now, now);
  db.prepare("INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,status,created_at) VALUES ('br','b','alice','h','x',1,'txt','completed',?)").run(now);
  db.prepare("INSERT INTO chapter_revisions (id,book_revision_id,revision_number,status,idempotency_key,created_at,confirmed_at) VALUES ('cr','br',1,'confirmed','c',?,?)").run(now, now);
  db.prepare("INSERT INTO framework_revisions (id,book_id,book_revision_id,chapter_revision_id,revision_number,status,created_at,confirmed_at) VALUES ('fr','b','br','cr',1,'confirmed',?,?)").run(now, now);
  db.prepare("INSERT INTO framework_nodes (id,framework_revision_id,parent_id,node_type,origin,title,summary,order_index,status,version,created_at,updated_at) VALUES ('n','fr',NULL,'source_claim','ai','损失厌恶','人们对损失更敏感',0,'confirmed',1,?,?)").run(now, now);
  db.prepare("INSERT INTO knowledge_evidence (id,framework_node_id,book_revision_id,source_unit_id,locator_json,quote,quote_hash,source_text_hash,is_valid,created_at) VALUES ('e','n','br','u','{\"kind\":\"text\"}','损失带来的痛苦强于同等收益的快乐','q','s',1,?)").run(now);
  let evaluateCalls = 0;
  const service = createBookExerciseService(db, {
    evaluate: async (args) => { evaluateCalls++; return evaluate ? evaluate(args) : {
      totalScore: 86,
      dimensions: args.trainingMode === 'one_minute_retell'
        ? { theoryAccuracy: { score: 90, evidenceIds: ['e'], feedback: '准确' }, coverage: { score: 80, evidenceIds: ['e'], feedback: '补充机制' }, structure: { score: 85, evidenceIds: [], feedback: '完整' }, clarity: { score: 88, evidenceIds: [], feedback: '清楚' }, durationControl: { score: 90, evidenceIds: [], feedback: '合适' } }
        : { definitionAccuracy: { score: 90, evidenceIds: ['e'], feedback: '准确' }, coreMechanism: { score: 80, evidenceIds: ['e'], feedback: '补充' }, exampleQuality: { score: 85, evidenceIds: [], feedback: '有效' }, boundaryCounterexample: { score: 70, evidenceIds: ['e'], feedback: '缺反例' }, plainClarity: { score: 88, evidenceIds: [], feedback: '清楚' } },
      summary: '总体良好', omissions: ['边界'], misconceptions: [], recommendedStructure: ['定义', '机制', '例子'], exemplar: '损失厌恶是……',
    }; },
    transcribe: transcribe || (async () => ({ rawTranscript: '原始口述', polishedTranscript: '润色口述' })),
    schedule: (work) => setImmediate(work),
    uploadRoot: path.join(root, 'audio'),
  });
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.auth = { userId: req.headers['x-user'] || 'alice' }; next(); });
  app.use('/api/books', createBookRouter({ db, storageRoot: path.join(root, 'storage'), exerciseService: service }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const request = (url, options = {}, user = 'alice') => fetch(`http://127.0.0.1:${server.address().port}${url}`, { ...options, headers: { 'x-user': user, 'content-type': 'application/json', ...(options.headers || {}) } });
  return { db, service, request, evaluateCalls: () => evaluateCalls, async settle() { while (await service.runOnce()) {} }, close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

async function createExercise(f, mode = 'one_minute_retell') {
  const response = await f.request('/api/books/b/frameworks/fr/nodes/n/exercises', { method: 'POST', body: JSON.stringify({ trainingMode: mode }) });
  assert.equal(response.status, 201); return (await response.json()).exercise;
}

test('仅 confirmed 指定节点创建两题型，题目含目标与证据', async () => { const f = await fixture(); try {
  for (const mode of ['one_minute_retell', 'concept_explanation']) { const exercise = await createExercise(f, mode); assert.equal(exercise.trainingMode, mode); assert.ok(exercise.prompt); assert.ok(exercise.goals.length); assert.equal(exercise.evidence[0].id, 'e'); }
  assert.equal((await f.request('/api/books/b/frameworks/fr/nodes/n/exercises', { method: 'POST', body: JSON.stringify({ trainingMode: 'other' }) })).status, 422);
  assert.equal((await f.request('/api/books/b/frameworks/fr/nodes/n/exercises', { method: 'POST', body: JSON.stringify({ trainingMode: 'one_minute_retell' }) }, 'bob')).status, 404);
} finally { f.close(); } });

test('60秒合理边界、空转写错误契约', async () => { const f = await fixture(); try {
  const exercise = await createExercise(f);
  for (const durationSeconds of [0, 61]) assert.equal((await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`, { method: 'POST', body: JSON.stringify({ taskId: `bad-${durationSeconds}`, rawTranscript: '内容', durationSeconds }) })).status, 422);
  const empty = await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`, { method: 'POST', body: JSON.stringify({ taskId: 'empty', rawTranscript: ' ', durationSeconds: 10 }) });
  assert.equal(empty.status, 422); assert.equal((await empty.json()).errorCode, 'TRANSCRIPTION_EMPTY');
} finally { f.close(); } });

test('评分只使用 raw 或用户明确 revisedTranscript，结构化结果持久化', async () => { const seen = []; const f = await fixture({ evaluate: async (args) => { seen.push(args.scoringTranscript); return { totalScore: 80, dimensions: { theoryAccuracy: { score: 80, evidenceIds: ['e'], feedback: 'ok' }, coverage: { score: 80, evidenceIds: [], feedback: 'ok' }, structure: { score: 80, evidenceIds: [], feedback: 'ok' }, clarity: { score: 80, evidenceIds: [], feedback: 'ok' }, durationControl: { score: 80, evidenceIds: [], feedback: 'ok' } }, summary: 'ok', omissions: [], misconceptions: [], recommendedStructure: [], exemplar: 'ok' }; } }); try {
  const a = await createExercise(f); await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${a.id}/evaluate`, { method: 'POST', body: JSON.stringify({ taskId: 't1', rawTranscript: 'RAW', polishedTranscript: 'POLISHED', durationSeconds: 30 }) });
  const b = await createExercise(f); await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${b.id}/evaluate`, { method: 'POST', body: JSON.stringify({ taskId: 't2', rawTranscript: 'RAW2', polishedTranscript: 'POLISHED2', revisedTranscript: 'REVISED', useRevisedTranscript: true, durationSeconds: 30 }) });
  await f.settle(); assert.deepEqual(seen, ['RAW', 'REVISED']);
  const detail = await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${a.id}`).then((r) => r.json()); assert.equal(detail.exercise.status, 'succeeded'); assert.equal(detail.exercise.evaluation.totalScore, 80); assert.equal(detail.exercise.evaluation.dimensions.theoryAccuracy.score, 80);
} finally { f.close(); } });

test('taskId/attempt 幂等且并发只评一次，同日用户 session 隔离', async () => { let release; const gate = new Promise((r) => { release = r; }); const f = await fixture({ evaluate: async () => { await gate; return { totalScore: 70, dimensions: { theoryAccuracy:{score:70,evidenceIds:[],feedback:''},coverage:{score:70,evidenceIds:[],feedback:''},structure:{score:70,evidenceIds:[],feedback:''},clarity:{score:70,evidenceIds:[],feedback:''},durationControl:{score:70,evidenceIds:[],feedback:''} }, summary:'',omissions:[],misconceptions:[],recommendedStructure:[],exemplar:'' }; } }); try {
  const exercise = await createExercise(f); const url = `/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`; const options = { method: 'POST', body: JSON.stringify({ taskId: 'same', rawTranscript: 'RAW', durationSeconds: 20 }) };
  const [a,b] = await Promise.all([f.request(url, options), f.request(url, options)]); assert.equal(a.status, 202); assert.equal(b.status, 202); release(); await f.settle();
  assert.equal(f.evaluateCalls(), 1); assert.equal(f.db.prepare('SELECT count(*) n FROM training_attempts').get().n, 1); assert.notEqual(JSON.parse(f.db.prepare('SELECT user_answer FROM training_attempts').get().user_answer).taskId, 'same');
} finally { f.close(); } });

test('不同 taskId 并发提交同一 exercise 返回同一持久任务且冻结评分快照', async () => { const seen=[]; const f=await fixture({evaluate:async(args)=>{seen.push(args.scoringTranscript);return {totalScore:70,dimensions:{theoryAccuracy:{score:70,evidenceIds:['e'],feedback:''},coverage:{score:70,evidenceIds:[],feedback:''},structure:{score:70,evidenceIds:[],feedback:''},clarity:{score:70,evidenceIds:[],feedback:''},durationControl:{score:70,evidenceIds:[],feedback:''}},summary:'',omissions:[],misconceptions:[],recommendedStructure:[],exemplar:''};}}); try { const exercise=await createExercise(f); const url=`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`; const a=await f.request(url,{method:'POST',body:JSON.stringify({taskId:'client-a',rawTranscript:'FIRST',durationSeconds:20})}).then(r=>r.json()); const b=await f.request(url,{method:'POST',body:JSON.stringify({taskId:'client-b',rawTranscript:'SECOND',durationSeconds:20})}).then(r=>r.json()); assert.equal(a.taskId,b.taskId); const task=f.db.prepare('SELECT * FROM book_exercise_tasks WHERE id=?').get(a.taskId); assert.equal(task.status,'pending'); assert.equal(JSON.parse(task.input_json).scoringTranscript,'FIRST'); await f.service.runOnce(); assert.deepEqual(seen,['FIRST']); } finally { f.close(); } });

test('重启恢复过期 lease、取消同步 exercise、旧 worker 拒写', async()=>{ const f=await fixture(); try { const exercise=await createExercise(f); const url=`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`; const task=await f.request(url,{method:'POST',body:JSON.stringify({taskId:'x',rawTranscript:'RAW',durationSeconds:20})}).then(r=>r.json()); const claimed=f.service.claimNext({now:100}); assert.ok(claimed); f.db.prepare("UPDATE book_exercise_tasks SET lease_expires_at=99 WHERE id=?").run(task.taskId); assert.equal(f.service.recoverExpired({now:100}),1); const takeover=f.service.claimNext({now:101}); assert.notEqual(takeover.leaseToken,claimed.leaseToken); assert.equal(f.service.completeTask({taskId:task.taskId,leaseToken:claimed.leaseToken,evaluation:{}}),false); const cancelled=await f.request(`${url}/cancel`,{method:'POST'}); assert.equal(cancelled.status,200); assert.equal((await cancelled.json()).exercise.status,'cancelled'); } finally { f.close(); } });

test('旧 running NULL lease 一次性升级恢复并可执行', async()=>{ const f=await fixture(); try { const exercise=await createExercise(f); await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`,{method:'POST',body:JSON.stringify({rawTranscript:'RAW',durationSeconds:20})}); f.db.prepare("UPDATE book_exercise_tasks SET status='running',lease_token='',lease_expires_at=NULL").run(); assert.equal(f.service.recoverLegacyRunning({now:Date.now()}),1); assert.equal(f.service.recoverLegacyRunning({now:Date.now()+1}),0); assert.equal(f.db.prepare('SELECT status FROM book_exercises WHERE id=?').get(exercise.id).status,'running'); await f.service.runOnce({now:Date.now()+2}); assert.equal(f.db.prepare('SELECT status FROM book_exercises WHERE id=?').get(exercise.id).status,'succeeded'); } finally { f.close(); } });

test('retryable 最多三次指数退避且退避前不可领取', async()=>{ let now=1000,calls=0; const error=Object.assign(new Error('temporary'),{retryable:true}); const f=await fixture({evaluate:async()=>{calls++;throw error;}}); try { const exercise=await createExercise(f); await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`,{method:'POST',body:JSON.stringify({rawTranscript:'RAW',durationSeconds:20})}); await f.service.runOnce({now}); let task=f.db.prepare('SELECT * FROM book_exercise_tasks').get(); assert.equal(task.status,'retrying'); assert.equal(task.attempt_count,1); assert.equal(task.next_attempt_at,2000); assert.equal(f.service.claimNext({now:1999}),null); now=2000; await f.service.runOnce({now}); task=f.db.prepare('SELECT * FROM book_exercise_tasks').get(); assert.equal(task.attempt_count,2); assert.equal(task.next_attempt_at,4000); assert.equal(f.service.claimNext({now:3999}),null); now=4000; await f.service.runOnce({now}); task=f.db.prepare('SELECT * FROM book_exercise_tasks').get(); assert.equal(calls,3); assert.equal(task.status,'failed'); assert.equal(task.lease_expires_at,null); assert.equal(f.db.prepare('SELECT status,error_code FROM book_exercises WHERE id=?').get(exercise.id).status,'failed'); } finally { f.close(); } });

test('失败、取消/lease拒写、历史 owner 与版本可读', async () => { const f = await fixture({ evaluate: async () => { throw new Error('boom'); } }); try {
  const exercise = await createExercise(f, 'concept_explanation'); await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}/evaluate`, { method: 'POST', body: JSON.stringify({ taskId: 'fail', rawTranscript: 'RAW', durationSeconds: 20 }) }); await f.settle();
  const detailResponse = await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}`); const detail = await detailResponse.json(); assert.equal(detail.exercise.status, 'failed'); assert.equal(detail.exercise.errorCode, 'EVALUATION_FAILED');
  assert.equal((await f.request(`/api/books/b/frameworks/fr/nodes/n/exercises/${exercise.id}`, {}, 'bob')).status, 404);
  const history = await f.request('/api/books/b/exercises').then((r) => r.json()); assert.equal(history.exercises[0].frameworkRevisionId, 'fr');
  assert.equal(f.service.completeTask({ taskId: 'fail', leaseToken: 'wrong', evaluation: {} }), false);
} finally { f.close(); } });
