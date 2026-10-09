const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const { initBookCore } = require('../services/bookService');
const { createBookFrameworkService } = require('../services/bookFrameworkService');

function mergeWorkflow(workflow) { return { ...workflow, runMerge: workflow.runMerge || (async ({ nodes }) => ({ nodes, runId: 'merge', tokenCount: 0, costAmount: 0 })) }; }

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-evidence-')); const db = new Database(path.join(root, 'db.sqlite')); initBookCore(db);
  const raw = path.join(root, 'raw.txt'); const corrected = path.join(root, 'corrected.txt'); fs.writeFileSync(raw, '原始 正文\n第二行'); fs.writeFileSync(corrected, '原始正文\n第二行'); const now = Date.now();
  db.prepare("INSERT INTO books (id,owner_id,title,original_file_name,status,active_book_revision_id,created_at,updated_at) VALUES ('b','alice','书','a.txt','processing_framework','r',?,?)").run(now, now);
  db.prepare("INSERT INTO book_revisions (id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,detected_format,status,created_at) VALUES ('r','b','alice','h',?,1,'txt','txt','completed',?)").run(raw, now);
  db.prepare("INSERT INTO chapter_revisions (id,book_revision_id,revision_number,status,idempotency_key,confirmed_at,created_at) VALUES ('cr','r',1,'confirmed','k',?,?)").run(now, now);
  db.prepare(`INSERT INTO book_chapters (id,book_revision_id,chapter_revision_id,title,level,order_index,start_locator_json,end_locator_json,source,status,version,created_at,updated_at) VALUES ('c','r','cr','章',1,0,'{"kind":"text","unitIndex":0,"char":0}','{"kind":"text","unitIndex":0,"char":8}','title','confirmed',1,?,?)`).run(now, now);
  db.prepare("INSERT INTO book_source_units (id,book_revision_id,unit_type,unit_index,raw_text_path,corrected_text_path,raw_text_hash,locator_json,status) VALUES ('u','r','text_range',0,?,?,?, '{}','completed')").run(raw, corrected, crypto.createHash('sha256').update('原始 正文\n第二行').digest('hex'));
  db.prepare("INSERT INTO book_jobs (id,book_id,owner_id,job_type,status,current_stage,idempotency_key,lease_token,lease_expires_at,created_at) VALUES ('j','b','alice','framework','running','extracting','framework:cr','lease',?,?)").run(now + 60_000, now);
  return { db, root, service: createBookFrameworkService(db), close() { db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

test('locator、quote、quote_hash、source_text_hash 均来自原始来源', () => { const f = fixture(); try {
  const evidence = f.service.validateEvidence({ bookRevisionId: 'r', sourceUnitId: 'u', locator: { kind: 'text', charStart: 0, charEnd: 5 }, quote: '原始 正文' });
  assert.equal(evidence.quoteHash, crypto.createHash('sha256').update('原始 正文').digest('hex')); assert.equal(evidence.sourceTextHash, crypto.createHash('sha256').update('原始 正文\n第二行').digest('hex'));
  assert.throws(() => f.service.validateEvidence({ bookRevisionId: 'r', sourceUnitId: 'u', locator: { kind: 'text', charStart: 0, charEnd: 2 }, quote: '伪证据' }), /evidence/i);
  assert.throws(() => f.service.validateEvidence({ bookRevisionId: 'r', sourceUnitId: 'u', locator: { kind: 'text', charStart: 0, charEnd: 1 }, quote: '第二行' }), /evidence/i);
} finally { f.close(); } });

test('允许一次受限规范化修复，仍不匹配则章节 failed 且不写伪证据', async () => { const f = fixture(); try {
  const workflow = { runChapter: async () => ({ runId: 'run', tokenCount: 3, costAmount: 0.1, nodes: [{ id: 'n', parentId: null, order: 0, title: 'T', summary: 'S', status: 'draft', version: 1, nodeType: 'source_claim', evidence: [{ segmentId: 'c:0', relativeCharStart: 0, relativeCharEnd: 4, quote: '原始正文' }] }] }) };
  await createBookFrameworkService(f.db, { workflow: mergeWorkflow(workflow) }).processJob({ jobId: 'j', leaseToken: 'lease' });
  assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_evidence').get().n, 1);
  f.db.prepare("DELETE FROM framework_revisions").run(); f.db.prepare("DELETE FROM framework_nodes").run(); f.db.prepare("DELETE FROM knowledge_evidence").run(); f.db.prepare("UPDATE book_job_steps SET status='pending'").run();
  workflow.runChapter = async () => ({ runId: 'bad', tokenCount: 1, costAmount: 0, nodes: [{ id: 'bad', parentId: null, order: 0, title: 'T', summary: 'S', status: 'draft', version: 1, nodeType: 'source_claim', evidence: [{ segmentId: 'c:0', relativeCharStart: 0, relativeCharEnd: 2, quote: '不存在' }] }] });
  await assert.rejects(createBookFrameworkService(f.db, { workflow: mergeWorkflow(workflow) }).processJob({ jobId: 'j', leaseToken: 'lease' }), /evidence/i); assert.equal(f.db.prepare('SELECT count(*) n FROM knowledge_evidence').get().n, 0); assert.equal(f.db.prepare("SELECT status FROM book_job_steps WHERE chapter_id='c'").get().status, 'failed');
} finally { f.close(); } });

test('completed step 从私有 JSON 恢复，损坏输出安全重跑且不丢章', async () => { const f = fixture(); try {
  let calls = 0; const workflow = { runChapter: async () => { calls++; return { runId: `run-${calls}`, tokenCount: 1, costAmount: 0, nodes: [{ id: `n-${calls}`, parentId: null, order: 0, title: 'T', summary: 'S', status: 'draft', version: 1, nodeType: 'structural', evidence: [] }] }; } };
  const service = createBookFrameworkService(f.db, { workflow: mergeWorkflow(workflow), outputRoot: path.join(f.root, 'outputs') });
  await service.processJob({ jobId: 'j', leaseToken: 'lease' }); const step = f.db.prepare("SELECT * FROM book_job_steps WHERE chapter_id='c'").get(); assert.ok(fs.existsSync(step.output_path)); assert.ok(step.output_hash);
  f.db.prepare('DELETE FROM framework_revisions').run(); f.db.prepare('DELETE FROM framework_nodes').run();
  await service.processJob({ jobId: 'j', leaseToken: 'lease' }); assert.equal(calls, 1); assert.equal(f.db.prepare('SELECT count(*) n FROM framework_nodes').get().n, 1);
  f.db.prepare('DELETE FROM framework_revisions').run(); f.db.prepare('DELETE FROM framework_nodes').run(); fs.writeFileSync(step.output_path, '{}');
  await service.processJob({ jobId: 'j', leaseToken: 'lease' }); assert.equal(calls, 2); assert.equal(f.db.prepare('SELECT count(*) n FROM framework_nodes').get().n, 1);
} finally { f.close(); } });

test('旧 worker lease 被接管后不得写 step 或 draft', async () => { const f = fixture(); try {
  const workflow = { runChapter: async () => { f.db.prepare("UPDATE book_jobs SET lease_token='new-lease',lease_expires_at=? WHERE id='j'").run(Date.now()+60000); return { runId: 'late', tokenCount: 1, costAmount: 0, nodes: [{ id: 'late', parentId: null, order: 0, title: 'T', summary: 'S', status: 'draft', version: 1, nodeType: 'structural', evidence: [] }] }; } };
  await assert.rejects(createBookFrameworkService(f.db, { workflow, outputRoot: path.join(f.root, 'outputs') }).processJob({ jobId: 'j', leaseToken: 'lease' }), (e) => e.errorCode === 'LEASE_LOST');
  assert.equal(f.db.prepare("SELECT count(*) n FROM book_job_steps WHERE status='completed'").get().n, 0); assert.equal(f.db.prepare('SELECT count(*) n FROM framework_revisions').get().n, 0);
} finally { f.close(); } });

test('两章请求只包含各自 locator 覆盖文本', async () => { const f = fixture(); try {
  const raw2=path.join(f.root,'raw2.txt'); fs.writeFileSync(raw2,'甲章正文乙章正文'); f.db.prepare("UPDATE book_source_units SET raw_text_path=?,corrected_text_path=?,raw_text_hash=? WHERE id='u'").run(raw2,raw2,crypto.createHash('sha256').update('甲章正文乙章正文').digest('hex'));
  f.db.prepare("UPDATE book_chapters SET start_locator_json=?,end_locator_json=? WHERE id='c'").run(JSON.stringify({kind:'text',unitIndex:0,char:0}),JSON.stringify({kind:'text',unitIndex:0,char:3}));
  const now=Date.now(); f.db.prepare("INSERT INTO book_chapters (id,book_revision_id,chapter_revision_id,title,level,order_index,start_locator_json,end_locator_json,source,status,version,created_at,updated_at) VALUES ('c2','r','cr','章二',1,1,?,?,'title','confirmed',1,?,?)").run(JSON.stringify({kind:'text',unitIndex:0,char:4}),JSON.stringify({kind:'text',unitIndex:0,char:7}),now,now);
  const seen=[]; const workflow={runChapter:async({chapter})=>{seen.push(chapter.text);return {runId:'r',tokenCount:0,costAmount:0,nodes:[{id:`n${seen.length}`,parentId:null,order:seen.length-1,title:'T',summary:'S',status:'draft',version:1,nodeType:'structural',evidence:[]}]};}};
  await createBookFrameworkService(f.db,{workflow:mergeWorkflow(workflow),outputRoot:path.join(f.root,'outputs')}).processJob({jobId:'j',leaseToken:'lease'}); assert.deepEqual(seen,['甲章正文','乙章正文']);
} finally { f.close(); } });

test('同一 unit 两章拒绝跨章和跨尾证据，相对坐标保存为绝对 locator', async () => { const f=fixture(); try {
  const text='x'.repeat(100)+'章一内容'+'y'.repeat(10)+'章二内容'; const file=path.join(f.root,'long.txt'); fs.writeFileSync(file,text); f.db.prepare("UPDATE book_source_units SET raw_text_path=?,corrected_text_path=?,raw_text_hash=? WHERE id='u'").run(file,file,crypto.createHash('sha256').update(text).digest('hex'));
  f.db.prepare("UPDATE book_chapters SET start_locator_json=?,end_locator_json=? WHERE id='c'").run(JSON.stringify({kind:'text',unitIndex:0,char:100}),JSON.stringify({kind:'text',unitIndex:0,char:103}));
  const chapter=f.db.prepare("SELECT * FROM book_chapters WHERE id='c'").get();
  assert.throws(()=>f.service.validateEvidence({bookRevisionId:'r',sourceUnitId:'u',locator:{kind:'text',unitIndex:0,charStart:114,charEnd:117},quote:'章二内容',chapter}),/outside chapter/i);
  assert.throws(()=>f.service.validateEvidence({bookRevisionId:'r',sourceUnitId:'u',locator:{kind:'text',unitIndex:0,charStart:102,charEnd:104},quote:text.slice(102,105),chapter}),/outside chapter/i);
  const workflow={runChapter:async()=>({runId:'r',tokenCount:0,costAmount:0,nodes:[{id:'relative',parentId:null,order:0,title:'T',summary:'S',status:'draft',version:1,nodeType:'source_claim',evidence:[{segmentId:'c:0',relativeCharStart:0,relativeCharEnd:3,quote:'章一内容'}]}]})};
  await createBookFrameworkService(f.db,{workflow:mergeWorkflow(workflow),outputRoot:path.join(f.root,'outputs')}).processJob({jobId:'j',leaseToken:'lease'}); const locator=JSON.parse(f.db.prepare('SELECT locator_json FROM knowledge_evidence').get().locator_json); assert.equal(locator.charStart,100); assert.equal(locator.charEnd,103);
} finally { f.close(); } });

test('多 unit 首尾片段基址映射正确', async () => { const f=fixture(); try {
  const f1=path.join(f.root,'u1.txt'),f2=path.join(f.root,'u2.txt');fs.writeFileSync(f1,'AAAA尾部');fs.writeFileSync(f2,'头部BBBB');f.db.prepare("UPDATE book_source_units SET raw_text_path=?,corrected_text_path=?,raw_text_hash=? WHERE id='u'").run(f1,f1,crypto.createHash('sha256').update('AAAA尾部').digest('hex'));f.db.prepare("INSERT INTO book_source_units (id,book_revision_id,unit_type,unit_index,raw_text_path,corrected_text_path,raw_text_hash,locator_json,status) VALUES ('u2','r','text_range',1,?,?,?,'{}','completed')").run(f2,f2,crypto.createHash('sha256').update('头部BBBB').digest('hex'));
  f.db.prepare("UPDATE book_chapters SET start_locator_json=?,end_locator_json=? WHERE id='c'").run(JSON.stringify({kind:'text',unitIndex:0,char:4}),JSON.stringify({kind:'text',unitIndex:1,char:1})); const seen=[];
  const workflow={runChapter:async({chapter})=>{seen.push(chapter.segments);return {runId:'r',tokenCount:0,costAmount:0,nodes:[{id:'multi',parentId:null,order:0,title:'T',summary:'S',status:'draft',version:1,nodeType:'source_claim',evidence:[{segmentId:chapter.segments[1].segmentId,relativeCharStart:0,relativeCharEnd:1,quote:'头部'}]}]};}};
  await createBookFrameworkService(f.db,{workflow:mergeWorkflow(workflow),outputRoot:path.join(f.root,'outputs')}).processJob({jobId:'j',leaseToken:'lease'});assert.equal(seen[0][0].absoluteBaseOffset,4);assert.equal(seen[0][1].absoluteBaseOffset,0);const locator=JSON.parse(f.db.prepare('SELECT locator_json FROM knowledge_evidence').get().locator_json);assert.equal(locator.unitIndex,1);assert.equal(locator.charStart,0);assert.equal(locator.charEnd,1);
} finally { f.close(); } });

test('全书归并作为独立持久步骤，归并结果才进入草稿', async () => { const f=fixture(); try {
  let merged=0; const workflow={runChapter:async()=>({runId:'chapter-run',tokenCount:0,costAmount:0,nodes:[{id:'chapter-node',parentId:null,order:0,title:'逐章',summary:'S',status:'draft',version:1,nodeType:'structural',evidence:[]}]}),runMerge:async({nodes})=>{merged++;assert.equal(nodes.length,1);return {runId:'merge-run',tokenCount:2,costAmount:0,nodes:[{id:'book-root',parentId:null,order:0,title:'全书根',summary:'S',status:'draft',version:1,nodeType:'structural',evidence:[]}]};}};
  await createBookFrameworkService(f.db,{workflow:mergeWorkflow(workflow),outputRoot:path.join(f.root,'outputs')}).processJob({jobId:'j',leaseToken:'lease'});
  assert.equal(merged,1); assert.equal(f.db.prepare("SELECT count(*) n FROM book_job_steps WHERE step_type='framework_merge' AND status='completed'").get().n,1); assert.equal(f.db.prepare('SELECT title FROM framework_nodes').get().title,'全书根');
} finally { f.close(); } });

test('确认拒绝多根、孤儿及无证据来源结论', () => { const f=fixture(); try {
  const revision=f.service.seedDraft({bookId:'b',ownerId:'alice',chapterRevisionId:'cr',nodes:[{id:'a',parentId:null,order:0,title:'A',summary:'S',status:'draft',version:1,nodeType:'structural',evidence:[]},{id:'b2',parentId:null,order:1,title:'B',summary:'S',status:'draft',version:1,nodeType:'source_claim',evidence:[]}]});
  assert.throws(()=>f.service.confirm({bookId:'b',ownerId:'alice',revisionId:revision.id,idempotencyKey:'x'}),(e)=>e.errorCode==='FRAMEWORK_QUALITY_FAILED'); assert.equal(f.db.prepare('SELECT status FROM framework_revisions WHERE id=?').get(revision.id).status,'draft');
} finally { f.close(); } });

test('证据 locator 按 PDF、电子书、TXT 格式规范化保存', () => { const f=fixture(); try {
  const txt=f.service.validateEvidence({bookRevisionId:'r',sourceUnitId:'u',locator:{kind:'text',unitIndex:0,charStart:0,charEnd:5},quote:'原始 正文'}); assert.equal(txt.locator.lineStart,1); assert.equal(txt.locator.lineEnd,1);
  f.db.prepare("UPDATE book_revisions SET detected_format='pdf' WHERE id='r'").run(); f.db.prepare("UPDATE book_source_units SET unit_type='page',unit_index=2 WHERE id='u'").run(); const pdf=f.service.validateEvidence({bookRevisionId:'r',sourceUnitId:'u',locator:{kind:'page',unitIndex:2,charStart:0,charEnd:5},quote:'原始 正文'}); assert.equal(pdf.locator.pageIndex,2); assert.equal('page' in pdf.locator,false);
  f.db.prepare("UPDATE book_revisions SET detected_format='epub' WHERE id='r'").run(); f.db.prepare("UPDATE book_source_units SET unit_type='xhtml',resource_path='Text/a.xhtml' WHERE id='u'").run(); assert.throws(()=>f.service.validateEvidence({bookRevisionId:'r',sourceUnitId:'u',locator:{kind:'resource',unitIndex:2,charStart:0,charEnd:5},quote:'原始 正文'}),(e)=>e.errorCode==='EVIDENCE_INVALID');
} finally { f.close(); } });

test('system_synthesis 必须追溯至少两个同版本来源节点', () => { const f=fixture(); try {
  const revision=f.service.seedDraft({bookId:'b',ownerId:'alice',chapterRevisionId:'cr',nodes:[{id:'root',parentId:null,order:0,title:'根',summary:'S',status:'draft',version:1,nodeType:'topic',origin:'structural',confidenceLevel:'high',sourceNodeIds:[],evidence:[]},{id:'s',parentId:'root',order:1,title:'综合',summary:'S',status:'draft',version:1,nodeType:'claim',origin:'system_synthesis',confidenceLevel:'medium',sourceNodeIds:['missing'],evidence:[]}]});
  assert.throws(()=>f.service.confirm({bookId:'b',ownerId:'alice',revisionId:revision.id,idempotencyKey:'x'}),(e)=>e.errorCode==='FRAMEWORK_QUALITY_FAILED');
} finally { f.close(); } });

test('取消后在途 Dify 结果拒写', async () => { const f = fixture(); try {
  const workflow = { runChapter: async () => { f.db.prepare("UPDATE book_jobs SET status='cancelled',cancel_requested_at=? WHERE id='j'").run(Date.now()); return { runId: 'late', tokenCount: 1, costAmount: 1, nodes: [] }; } };
  await assert.rejects(createBookFrameworkService(f.db, { workflow: mergeWorkflow(workflow) }).processJob({ jobId: 'j', leaseToken: 'lease' }), (e) => e.errorCode === 'CANCELLED'); assert.equal(f.db.prepare('SELECT count(*) n FROM framework_nodes').get().n, 0);
} finally { f.close(); } });
