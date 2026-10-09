const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('systemd loads secrets from protected environment file and applies limits', () => {
  const service = read('super-agent-vocab.service');
  assert.match(service, /^EnvironmentFile=\/etc\/super-agent\/vocab\.env$/m);
  assert.match(service, /^ExecStart=\/usr\/bin\/node --max-old-space-size=768 /m);
  assert.doesNotMatch(service, /Environment=.*(?:API_KEY|_KEY|PASSWORD|SECRET|TOKEN)=/i);
  for (const directive of ['NoNewPrivileges=true', 'PrivateTmp=true', 'ProtectSystem=strict', 'ProtectHome=true', 'MemoryHigh=1100M', 'MemoryMax=1300M', 'TasksMax=', 'LimitNOFILE=', 'UMask=0077']) assert.match(service, new RegExp(`^${directive}`, 'm'));
  assert.match(service, /^ReadWritePaths=\/var\/www\/super-agent\/vocab-server\/private \/var\/lib\/super-agent$/m);
  assert.doesNotMatch(service, /^ReadWritePaths=.*(?:\/var\/www\/super-agent |\/var\/www\/super-agent$)/m);
  assert.match(read('vocab-server/server.js'), /SUPER_AGENT_DB_PATH \|\| process\.env\.VOCAB_DB_PATH \|\| \(isProd \? '\/var\/lib\/super-agent\/vocab\.db'/);
});

test('deploy script has no password fallback, env transfer, automatic commit, or partial-release exposure', () => {
  const script = read('deploy-smart.ps1');
  assert.doesNotMatch(script, /\$SSHPassword\s*=\s*['"][^'"]+/);
  assert.doesNotMatch(script, /cat \$RemoteEnvPath|Send-File .*\.env|git add -A|git commit|git push/);
  assert.match(script, /\[SecureString\]\$SSHPassword/);
  assert.match(script, /\[Convert\]::ToBase64String\(\[Text\.Encoding\]::UTF8\.GetBytes\(\$Command\)\)/);
  assert.match(script, /base64 -d \| bash/);
  assert.doesNotMatch(script, /\$Command \| ssh/);
  assert.match(script, /git ls-files --others --exclude-standard/);
  assert.match(script, /package-lock\.json/);
  assert.match(script, /npm ci/);
  assert.match(script, /backend-changes\.tar\.gz/);
  assert.match(script, /tar -xzf/);
  assert.match(script, /Copy-Item \$localFile \$stagePath/);
  assert.doesNotMatch(script, /Uploading atomically:/);
  assert.match(script, /super-agent-vocab\.service"\s+"\/tmp\/super-agent-vocab\.service/);
  assert.match(script, /ebook-convert --version/i);
  assert.match(script, /BOOK_OCR_ENABLED/);
  assert.match(script, /OCR capability disabled/);
  assert.match(script, /\$RemoteReleaseBase = '\/var\/backups\/super-agent\/releases'/);
  assert.match(script, /release-\$timestamp/);
  assert.match(script, /rollback/i);
  assert.match(script, /app\.liujingzhuwo\.site\.candidate/);
  assert.doesNotMatch(script, /catch \{\}/);
  assert.match(script, /systemctl stop super-agent-vocab\.service[\s\S]*trap 'sudo systemctl start super-agent-vocab\.service' EXIT[\s\S]*cp \/var\/lib\/super-agent\/vocab\.db/);
  assert.match(script, /healthy=0;[\s\S]*healthy=1;[\s\S]*\|\| exit 1/);
  assert.match(script, /nginx\.previous[\s\S]*\$nginxConfigTouched = \$true[\s\S]*app\.liujingzhuwo\.site\.candidate/);
  assert.doesNotMatch(script, /cp -a \$RemoteApiRoot\/\. \$remoteReleaseRoot\/backend\/ && sudo cp[^\r\n]*\|\| true/);
  assert.doesNotMatch(script, /backfill-dict-level\.js \/var\/www\/super-agent\/vocab\.db/);
  assert.match(script, /backfill-dict-level\.js \/var\/lib\/super-agent\/vocab\.db/);
  assert.match(script, /npm run verify:book-mvp/);
  for (const name of ['DIFY_BOOK_FRAMEWORK_API_KEY','DIFY_BOOK_FRAMEWORK_URL','DIFY_BOOK_LISTEN_API_KEY','DIFY_BOOK_LISTEN_URL','DIFY_BOOK_EXERCISE_API_KEY','DIFY_BOOK_EXERCISE_URL']) assert.match(script, new RegExp(name));
  assert.match(script, /12884901888/);
  assert.match(script, /sed -i 's\/\\r\$\/\/' \/tmp\/deploy-book-light\.sh/);
  assert.doesNotMatch(script, /sed -i 's\/`r/);
  assert.match(script, /bash -n \/tmp\/deploy-book-light\.sh/);
  assert.match(script, /bash \/tmp\/deploy-book-light\.sh --self-check/);
  assert.doesNotMatch(script, /grep -q ['"]vocab\.env\.candidate['"] \/tmp\/deploy-book-light\.sh/);
  assert.match(script, /test -d \$remoteReleaseRoot/);
  assert.match(script, /test -w \$remoteReleaseRoot/);
  const light = read('scripts/deploy-book-light.sh');
  assert.match(light, /if \[\[ \$\{1:-\} == --self-check \]\]/);
  assert.match(light, /SELF_CHECK_OK/);
  assert.match(light, /exit 0/);
  assert.ok(light.indexOf('SELF_CHECK_OK') < light.indexOf('sudo mkdir -p "$release/backend"'));
  assert.match(light, /vocab\.env\.candidate/);
  assert.match(light, /install -m 0600/);
  assert.match(light, /BOOK_MVP_PROFILE=light/);
  assert.match(light, /BOOK_OCR_ENABLED=false/);
  assert.match(light, /systemctl show -p MainPID/);
  assert.match(light, /\/proc\/\$pid\/environ/);
  assert.match(light, /test -d "\$release\/backend"/);
  assert.match(light, /test -f "\$release\/vocab\.env\.previous"/);
  assert.match(light, /trap rollback ERR/);
  assert.match(light, /mkdir -p \/var\/lib\/super-agent/);
  assert.match(light, /test -w \/var\/lib\/super-agent/);
  assert.match(light, /sudo rm -f "\$env_candidate"/);
  assert.doesNotMatch(script, /sudo sh -c ''/);
});

test('nginx gives books a bounded streaming upload location without changing API path', () => {
  const nginx = read('app.liujingzhuwo.site');
  assert.match(nginx, /location \^~ \/api\/books\s*\{[\s\S]*?client_max_body_size 50m;[\s\S]*?client_body_timeout[\s\S]*?proxy_request_buffering off;[\s\S]*?proxy_pass http:\/\/127\.0\.0\.1:3001;/);
  assert.doesNotMatch(nginx, /client_max_body_size 1024m/);
  assert.match(nginx, /Accept-Ranges/);
});

test('OCR compose is loopback-only and resource constrained', () => {
  const compose = read('ops/umi-ocr/compose.yml');
  for (const value of ['127.0.0.1:1224:1224', 'mem_limit: 1200m', 'memswap_limit: 1400m', 'cpus:', 'pids_limit:', 'read_only: true', 'tmpfs:', 'healthcheck:', 'restart:']) assert.match(compose, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(compose, /image:\s*\$\{UMI_OCR_IMAGE:-[^}]+\}/);
});

test('disk admission uses 12 GiB floor and required-space formula', () => {
  const { requiredSpaceBytes, canAcceptUpload } = require('../services/bookCleanupService');
  const GiB = 1024 ** 3;
  assert.equal(requiredSpaceBytes(50 * 1024 ** 2), 912 * 1024 ** 2);
  assert.equal(canAcceptUpload({ availableBytes: 11 * GiB, uploadBytes: 1 }), false);
  assert.equal(canAcceptUpload({ availableBytes: 13 * GiB, uploadBytes: 50 * 1024 ** 2 }), true);
});

test('heavy resource gate waits for safe host memory, swap, and load watermarks', async () => {
  const { createHeavyResourceGate } = require('../services/heavyResourceGate');
  let checks = 0; const sleeps = [];
  const gate = createHeavyResourceGate({ profile: 'full', inspect: () => ++checks === 1 ? { availableMemory: 800, swapUsed: 0, loadAverage: 0 } : { availableMemory: 1300, swapUsed: 0, loadAverage: 0 }, sleep: async (ms) => sleeps.push(ms), pollMs: 5, thresholds: { minAvailableMemory: 1200, maxSwapUsed: 512, maxLoadAverage: 4 } });
  assert.equal(await gate.run(async () => 'ok'), 'ok'); assert.deepEqual(sleeps, [5]);
});

test('heavy resource gate waiting is cancellable and bounded', async () => {
  const { createHeavyResourceGate } = require('../services/heavyResourceGate');
  const unsafe = () => ({ availableMemory: 1, swapUsed: 999, loadAverage: 99 });
  const gate = createHeavyResourceGate({ inspect: unsafe, sleep: async () => {}, pollMs: 1, maxWaitMs: 2 });
  await assert.rejects(gate.run(async () => {}, {}), (error) => error.errorCode === 'RESOURCE_BUSY');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(gate.run(async () => {}, { signal: controller.signal }), (error) => error.name === 'AbortError');
});

test('light gate ignores cold swap but rejects low available memory immediately with stable contract', async () => {
  const { createHeavyResourceGate } = require('../services/heavyResourceGate');
  const coldSwap = createHeavyResourceGate({ profile: 'light', inspect: () => ({ availableMemory: 900, swapUsed: 1800, loadAverage: 0.1 }) });
  assert.equal(await coldSwap.run(async () => 'ok'), 'ok');
  const constrained = createHeavyResourceGate({ profile: 'light', inspect: () => ({ availableMemory: 700, swapUsed: 0, loadAverage: 0.1 }) });
  const started = Date.now();
  await assert.rejects(constrained.run(async () => 'never'), (error) => error.errorCode === 'RESOURCE_BUSY' && error.message === '服务器繁忙，请稍后重试' && error.retryable === true && error.httpStatus === 503);
  assert.ok(Date.now() - started < 100, 'light gate must fail fast');
});

test('full gate preserves original hard swap watermark', async () => {
  const { createHeavyResourceGate } = require('../services/heavyResourceGate');
  const gate = createHeavyResourceGate({ profile: 'full', inspect: () => ({ availableMemory: 4096, swapUsed: 1800, loadAverage: 0 }), sleep: async () => {}, maxWaitMs: 1 });
  await assert.rejects(gate.run(async () => 'never'), (error) => error.errorCode === 'RESOURCE_BUSY');
});

test('host inspection respects tighter cgroup memory and CPU quota', () => {
  const { inspectHost } = require('../services/heavyResourceGate');
  const files = { '/proc/meminfo': 'SwapTotal: 1024 kB\nSwapFree: 512 kB\n', '/sys/fs/cgroup/memory.max': '943718400', '/sys/fs/cgroup/memory.current': '104857600', '/sys/fs/cgroup/cpu.max': '150000 100000' };
  const state = inspectHost({ read: (name) => { if (!(name in files)) throw new Error('missing'); return files[name]; }, freeMemory: () => 4 * 1024 ** 3, loadAverage: () => [3], cpuCount: () => 8 });
  assert.equal(state.availableMemory, 800); assert.equal(state.swapUsed, 0.5); assert.equal(state.loadAverage, 2);
});

test('upload semaphore limits concurrency to two and releases failures', async () => {
  const { createSemaphore } = require('../services/bookCleanupService');
  const semaphore = createSemaphore(2);
  let active = 0;
  let peak = 0;
  const run = (fail = false) => semaphore.run(async () => {
    active += 1; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    if (fail) throw new Error('expected');
  });
  await Promise.allSettled([run(true), run(), run(), run()]);
  assert.equal(peak, 2);
  await semaphore.run(async () => {});
});

test('book upload responses always expose stable errorCode', () => {
  const source = read('vocab-server/services/bookService.js');
  const uploadSlice = source.slice(source.indexOf("router.post('/',"), source.indexOf("router.get('/',"));
  assert.doesNotMatch(uploadSlice, /\.json\(\{ error: (?:error|err)\.message \}\)/);
  assert.match(uploadSlice, /DISK_SPACE_LOW/);
  assert.match(uploadSlice, /reply\(503, '服务器繁忙，请稍后重试', 'RESOURCE_BUSY', true\)/);
});

test('book deletion cleanup is scheduled in production', () => {
  const server = read('vocab-server/server.js');
  assert.match(server, /bookCleanupTimer\s*=\s*setInterval/);
  assert.match(server, /bookCleanup\.cleanup\(/);
  assert.match(server, /clearInterval\(bookCleanupTimer\)/);
});

test('deletion queue refuses revision paths outside book storage', () => {
  const os = require('node:os');
  const { processDeletionQueue } = require('../services/bookCleanupService');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-cleanup-'));
  const storage = path.join(root, 'storage');
  const outside = path.join(root, 'outside.txt');
  fs.mkdirSync(storage);
  fs.writeFileSync(outside, 'keep');
  const db = {
    exec() {},
    prepare(sql) { return {
      all() {
        if (sql.includes('book_deletion_items')) return [{ id: 1, item_type: 'local', book_id: 'book-1' }];
        if (sql.includes('book_revisions')) return [{ file_path: outside }];
        return [];
      },
      run() {},
    }; },
  };
  processDeletionQueue(db, storage);
  assert.equal(fs.existsSync(outside), true);
});

test('deletion queue removes relational children and book knowledge without orphaning private content', () => {
  const Database = require('better-sqlite3');
  const { initBookCore } = require('../services/bookService');
  const { processDeletionQueue, requestDeletion } = require('../services/bookCleanupService');
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-cascade-'));
  const storage = path.join(root, 'storage'); fs.mkdirSync(storage);
  const db = new Database(path.join(root, 'db')); initBookCore(db); const now = Date.now();
  db.exec("CREATE TABLE knowledge_vault (id TEXT PRIMARY KEY,user_id TEXT,type TEXT,title TEXT,summary TEXT,content TEXT,source TEXT,added_at INTEGER,extra_json TEXT); CREATE TABLE knowledge_vault_revisions (id TEXT PRIMARY KEY,knowledge_id TEXT,user_id TEXT,snapshot_json TEXT,created_at INTEGER); CREATE TABLE knowledge_vault_traces (id TEXT PRIMARY KEY,knowledge_id TEXT,user_id TEXT,module TEXT,action TEXT,used_at INTEGER)");
  const bookId = '11111111-1111-4111-8111-111111111111';
  db.prepare('INSERT INTO books(id,owner_id,title,original_file_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(bookId,'alice','t','t.txt','ready',now,now);
  db.prepare('INSERT INTO book_revisions(id,book_id,owner_id,source_file_hash,file_path,file_size,declared_extension,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('br',bookId,'alice','h',path.join(storage,'source.txt'),1,'txt','completed',now); fs.writeFileSync(path.join(storage,'source.txt'),'x');
  db.prepare("INSERT INTO book_source_units(id,book_revision_id,unit_type,unit_index,status) VALUES('u','br','text_range',0,'completed')").run();
  db.prepare("INSERT INTO chapter_revisions(id,book_revision_id,revision_number,status,idempotency_key,created_at) VALUES('cr','br',1,'confirmed','k',?)").run(now);
  db.prepare("INSERT INTO book_chapters(id,book_revision_id,chapter_revision_id,title,level,order_index,start_locator_json,end_locator_json,source,status,created_at,updated_at) VALUES('c','br','cr','c',1,0,'{}','{}','auto','confirmed',?,?)").run(now,now);
  db.prepare("INSERT INTO framework_revisions(id,book_id,book_revision_id,chapter_revision_id,revision_number,status,created_at) VALUES('fr',?,'br','cr',1,'confirmed',?)").run(bookId,now);
  db.prepare("INSERT INTO framework_nodes(id,framework_revision_id,node_type,origin,title,summary,order_index,status,version,created_at,updated_at) VALUES('n','fr','concept','ai','n','s',0,'confirmed',1,?,?)").run(now,now);
  db.prepare("INSERT INTO knowledge_evidence(id,framework_node_id,book_revision_id,source_unit_id,locator_json,quote,quote_hash,source_text_hash,created_at) VALUES('e','n','br','u','{}','q','h','h',?)").run(now);
  db.prepare("INSERT INTO knowledge_vault(id,user_id,type,title,summary,content,source,added_at,extra_json) VALUES('book-framework:n','alice','theory','n','s','s',?,?,'{}')").run(`book:${bookId}`,now);
  db.prepare("INSERT INTO knowledge_vault_revisions VALUES('kvr','book-framework:n','alice','{}',?)").run(now); db.prepare("INSERT INTO knowledge_vault_traces(id,knowledge_id,user_id,module,action,used_at) VALUES('kvt','book-framework:n','alice','book','use',?)").run(now);
  requestDeletion(db,bookId,now); processDeletionQueue(db,storage);
  for (const table of ['books','book_revisions','book_source_units','chapter_revisions','book_chapters','framework_revisions','framework_nodes','knowledge_evidence','knowledge_vault','knowledge_vault_revisions','knowledge_vault_traces']) assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0,table);
  db.close(); fs.rmSync(root,{recursive:true,force:true});
});

test('deletion queue rejects symlink traversal and malicious book ids', (t) => {
  const os = require('node:os');
  const { processDeletionQueue } = require('../services/bookCleanupService');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-cleanup-link-'));
  const storage = path.join(root, 'storage');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(storage); fs.mkdirSync(outside);
  const victim = path.join(outside, 'victim.txt'); fs.writeFileSync(victim, 'keep');
  const link = path.join(storage, 'link');
  try { fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); } catch (error) { t.skip(`symlink unavailable: ${error.code}`); return; }
  const rows = [{ id: 1, item_type: 'local', book_id: '../../outside' }, { id: 2, item_type: 'local', book_id: 'book-2' }];
  const db = { exec() {}, prepare(sql) { return {
    all(bookId) {
      if (sql.includes('book_deletion_items')) return rows;
      if (sql.includes('book_revisions') && bookId === 'book-2') return [{ file_path: path.join(link, 'victim.txt') }];
      return [];
    },
    run() {},
  }; } };
  processDeletionQueue(db, storage);
  assert.equal(fs.existsSync(victim), true);
  assert.equal(fs.existsSync(outside), true);
});
