const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===========================================================');
console.log(' 🔍 [Web Error Diagnostic Tool] 网页无法打开/白屏全面诊断脚本');
console.log(' 目标域名: https://app.liujingzhuwo.site/');
console.log('===========================================================\n');

const distPath = '/var/www/super-agent/dist';
const indexPath = path.join(distPath, 'index.html');

// 1. 检查前端打包产物与文件权限
console.log('📋 [检查 1: 静态资源产物与入口 JS 文件]');
if (fs.existsSync(indexPath)) {
  console.log(` ✅ index.html 存在 (路径: ${indexPath})`);
  const htmlContent = fs.readFileSync(indexPath, 'utf-8');
  const jsMatch = htmlContent.match(/src="([^"]+index-[^"]+\.js)"/);
  if (jsMatch) {
    const jsRelPath = jsMatch[1];
    const jsFullPath = path.join(distPath, jsRelPath.replace(/^\//, ''));
    console.log(` 📌 HTML 中引用的入口 JS 相对路径: ${jsRelPath}`);
    if (fs.existsSync(jsFullPath)) {
      const stat = fs.statSync(jsFullPath);
      console.log(` ✅ 入口 JS [${path.basename(jsFullPath)}] 存在且正常！大小: ${(stat.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(` ❌ 入口 JS [${jsFullPath}] 在磁盘上不存在！会导致 404 白屏！`);
    }
  } else {
    console.log(` ⚠️ 未能在 index.html 中匹配到 script src 标签`);
  }
} else {
  console.log(` ❌ index.html 不存在于 ${distPath}！请检查打包产物路径。`);
}

// 2. 检查 Nginx 访问与错误日志
console.log('\n🌐 [检查 2: Nginx 错误日志分析 (近30条)]');
try {
  const nginxLogs = execSync('sudo tail -n 30 /var/log/nginx/error.log 2>/dev/null || true').toString().trim();
  if (nginxLogs) {
    console.log(nginxLogs);
  } else {
    console.log(' ✅ 未发现 Nginx 错误日志。');
  }
} catch (e) {
  console.log(' ⚠️ 无法读取 Nginx 错误日志:', e.message);
}

// 3. 检查 Node 后端服务与端口健康度
console.log('\n🚀 [检查 3: 后端 Node 3001 端口服务状态]');
try {
  const serviceStatus = execSync('sudo systemctl is-active super-agent-vocab.service 2>/dev/null || true').toString().trim();
  console.log(` - Node 后端服务运行状态: ${serviceStatus === 'active' ? '✅ active (正常运行中)' : '❌ inactive/failed (已停止)'}`);
} catch (e) {}

// 4. 检查 Nginx 域名绑定与配置文件检索
console.log('\n🔒 [检查 4: Nginx 域名绑定与配置文件检索]');
try {
  const nginxConf = execSync('grep -rn "app.liujingzhuwo.site" /etc/nginx/ 2>/dev/null || true').toString().trim();
  console.log(nginxConf || ' ⚠️ 未搜寻到包含 app.liujingzhuwo.site 的特定 Nginx 配置文件');
} catch (e) {}

console.log('\n===========================================================');
