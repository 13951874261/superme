const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'vocab.db');
const db = new Database(dbPath);

console.log('--- 启动 1-B 句型提取入库功能测试 ---');

// 1. 初始化测试数据或状态
db.prepare("DELETE FROM vocabulary WHERE dict_type = 'ai_sentence'").run();

// 2. 模拟 process-and-extract 路径里的句子排重写入逻辑
function insertTestSentence(sentStr, topic) {
  const now = Date.now();
  const s = sentStr.trim();
  if (!s || s.length > 500) return { success: false, reason: 'invalid length' };

  // 1-B 精准查重探针：以前 50 字符作为模糊匹配键
  const probe = s.substring(0, 50).replace(/[%_]/g, '\\$&');
  const existingSent = db.prepare(
    "SELECT id, word FROM vocabulary WHERE dict_type = 'ai_sentence' AND word LIKE ? COLLATE NOCASE"
  ).get(`${probe}%`);

  if (!existingSent) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO vocabulary (id, word, dict_type, category, payload, added_at, next_review_date, review_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, s, 'ai_sentence', topic || 'daily_extraction', JSON.stringify({ source: 'Test', topic, type: 'sentence' }), now, now, '[]');
    return { success: true, inserted: id };
  } else {
    return { success: false, reason: 'duplicate', existingId: existingSent.id };
  }
}

// 执行测试用例 1：全新句型入库
const t1 = insertTestSentence("We need to construct a comprehensive risk mitigation framework.", "business");
console.log('用例 1 (全新句型写入)：', t1.success ? '通过 ✅' : '失败 ❌', t1);

// 执行测试用例 2：相似句型排重（例如只是末尾标点有差异或部分单词变化）
const t2 = insertTestSentence("We need to construct a comprehensive risk mitigation framework to address potential compliance issues.", "business");
console.log('用例 2 (前50字符相似排重)：', !t2.success && t2.reason === 'duplicate' ? '通过 ✅' : '失败 ❌', t2);

// 执行测试用例 3：不相似句型入库
const t3 = insertTestSentence("The board of directors approved the financial statement.", "finance");
console.log('用例 3 (新主题不同句型写入)：', t3.success ? '通过 ✅' : '失败 ❌', t3);

// 3. 统计并打印最终数据库结果
const rows = db.prepare("SELECT word, dict_type, category FROM vocabulary WHERE dict_type = 'ai_sentence'").all();
console.log('当前数据库存留 ai_sentence 数：', rows.length);
console.log(rows);

if (rows.length === 2) {
  console.log('===> 1-B 功能单元测试全部通过！✅');
} else {
  console.log('===> 1-B 功能单元测试失败！❌');
}
db.close();
