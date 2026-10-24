const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.NODE_ENV === 'production' || __dirname.includes('/var/www')
  ? '/var/www/super-agent/vocab.db'
  : path.join(__dirname, '..', 'vocab.db');

const envPath = path.join(__dirname, '..', '.env');

console.log('===========================================================');
console.log(' 🩺 [Super-Agent Cron Health Check] 后台定时任务生效与运行检查诊断');
console.log('===========================================================');
console.log(` ⏰ 当前本地时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
console.log(` 📂 检查环境文件: ${envPath}`);
console.log(` 💾 检查数据库:   ${dbPath}\n`);

// 1. 检查环境变量配置
let envHour = process.env.DAILY_PACK_CRON_HOUR;
let envEnabled = process.env.DAILY_PACK_CRON_ENABLED;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hourMatch = envContent.match(/^DAILY_PACK_CRON_HOUR=(.*)$/m);
  const enabledMatch = envContent.match(/^DAILY_PACK_CRON_ENABLED=(.*)$/m);
  if (hourMatch) envHour = hourMatch[1].trim();
  if (enabledMatch) envEnabled = enabledMatch[1].trim();
}

console.log('1️⃣ 【环境变量与配置项检查】');
console.log(`   - DAILY_PACK_CRON_HOUR:    ${envHour || '未显式配置 (默认 2)'} ${envHour === '2' ? '✅ (正确设置为 02:00)' : '⚠️ (可能为旧值)'}`);
console.log(`   - DAILY_PACK_CRON_ENABLED: ${envEnabled || 'true'} ${envEnabled !== 'false' ? '✅ (已启用)' : '❌ (已禁用)'}`);

// 2. 检查数据库连通性与结构状态
console.log('\n2️⃣ 【数据库及升级 Migration 检查】');
if (!fs.existsSync(dbPath)) {
  console.log(`   ❌ 错误: 数据库文件不存在 ${dbPath}`);
  process.exit(1);
}

const stats = fs.statSync(dbPath);
const dbSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`   - 数据库文件物理体积: ${dbSizeMB} MB ${stats.size < 1024 * 1024 * 1024 ? '✅ (处于 1GB 安全范围内)' : '⚠️ (超过 1GB，需触发 LRU 清理)'}`);

const db = new Database(dbPath, { readonly: true });

try {
  // 检查表结构 v2
  const articleTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_extracted_articles'").get()?.sql || '';
  const hasSig = articleTableSql.includes('input_signature');
  const hasDuration = articleTableSql.includes('duration');
  const isV2Unique = articleTableSql.includes('UNIQUE(user_id, quota_date, input_signature)');

  console.log(`   - input_signature 字段: ${hasSig ? '✅ 存在' : '❌ 缺失'}`);
  console.log(`   - duration 字段:         ${hasDuration ? '✅ 存在' : '❌ 缺失'}`);
  console.log(`   - v2 防重唯一索引约束:  ${isV2Unique ? '✅ 满足 UNIQUE(user_id, quota_date, input_signature)' : '⚠️ 旧版约束'}`);
} catch (e) {
  console.log(`   ❌ 数据库表校验失败: ${e.message}`);
}

// 3. 检查近 3 天数据落地与自动生成情况
console.log('\n3️⃣ 【数据自动生成落库验证 (近 3 天)】');
try {
  const recentPacks = db.prepare(`
    SELECT pack_date, COUNT(*) as count 
    FROM daily_packs 
    GROUP BY pack_date 
    ORDER BY pack_date DESC LIMIT 3
  `).all();

  console.log('   - 近期 daily_packs (唤醒/破绽焦点) 自动生成分布:');
  if (recentPacks.length === 0) {
    console.log('     ⚠️ 暂无任何数据');
  } else {
    recentPacks.forEach(row => {
      console.log(`     * 日期 [${row.pack_date}]: ${row.count} 条生成的关卡数据`);
    });
  }

  const recentArticles = db.prepare(`
    SELECT quota_date, COUNT(*) as count, GROUP_CONCAT(DISTINCT duration) as durations 
    FROM daily_extracted_articles 
    GROUP BY quota_date 
    ORDER BY quota_date DESC LIMIT 3
  `).all();

  console.log('   - 近期 daily_extracted_articles (长文提纯) 自动生成分布:');
  if (recentArticles.length === 0) {
    console.log('     ⚠️ 暂无任何长文数据');
  } else {
    recentArticles.forEach(row => {
      console.log(`     * 日期 [${row.quota_date}]: ${row.count} 篇持久化长文 (时长透传分布: ${row.durations || '15min'})`);
    });
  }
} catch (e) {
  console.log(`   ❌ 检查数据分布失败: ${e.message}`);
}

console.log('\n===========================================================');
console.log(' 💡 诊断完成。如需查看 PM2/Systemd 实时日志，请在终端输入:');
console.log('    sudo journalctl -u super-agent-vocab.service -n 30 --no-pager');
console.log('===========================================================\n');

db.close();
