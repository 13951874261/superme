import fs from 'fs';
import path from 'path';

// 目标目录
const SRC_DIR = path.join(process.cwd(), 'src');
const DOCS_DIR = path.join(process.cwd(), 'docs');
const OUTPUT_FILE = path.join(DOCS_DIR, 'ui-ux-suggestions.md');
const HISTORY_DIR = path.join(DOCS_DIR, 'ui-ux-suggestions', 'history');

// 简单的 UI/UX 规则
const rules = [
  {
    id: 'hardcoded-color',
    regex: /color:\s*#[0-9a-fA-F]{3,6}|color:\s*(red|blue|green|yellow|black|white)/g,
    issue: '检测到硬编码颜色',
    suggestion: '请使用 Tailwind 变量或 CSS 变量统一管理颜色以支持主题切换。',
    priority: '高'
  },
  {
    id: 'missing-aria-label',
    regex: /<button(?!.*aria-label)[^>]*>/g,
    issue: '按钮缺少 aria-label',
    suggestion: '提升无障碍体验(A11y)，为无文本按钮添加 aria-label。',
    priority: '中'
  },
  {
    id: 'inline-styles',
    regex: /style={{[^}]*}}/g,
    issue: '存在内联样式',
    suggestion: '推荐使用 Tailwind 类名替代内联样式，保持设计系统一致性。',
    priority: '低'
  },
  {
    id: 'missing-hover',
    regex: /class(Name)?=["'][^"']*(?:button|btn|link)[^"']*["']/g,
    validate: (match) => !match.includes('hover:'),
    issue: '交互元素可能缺少 hover 反馈',
    suggestion: '为按钮或链接添加 hover: 样式，提升交互反馈（UX）。',
    priority: '中'
  }
];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(fullPath)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function runAudit() {
  const files = scanDirectory(SRC_DIR);
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);
    
    rules.forEach(rule => {
      let match;
      const regex = new RegExp(rule.regex);
      while ((match = regex.exec(content)) !== null) {
        if (rule.validate && !rule.validate(match[0])) continue;
        
        // 计算行号
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        findings.push({
          file: relativePath,
          line: lineNumber,
          issue: rule.issue,
          suggestion: rule.suggestion,
          priority: rule.priority,
          snippet: match[0].substring(0, 80) + (match[0].length > 80 ? '...' : '')
        });
      }
    });
  }

  return findings;
}

function generateReport(findings) {
  const dateStr = new Date().toISOString().split('T')[0];
  let md = `# UI/UX 分析建议报告 — ${dateStr}\n\n`;
  md += `> 自动生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  if (findings.length === 0) {
    md += '🎉 太棒了！本次扫描未发现明显的 UI/UX 规则违背项。\n';
  } else {
    md += `共发现 **${findings.length}** 项建议。\n\n`;
    
    const sorted = findings.sort((a, b) => {
      const p = { '高': 3, '中': 2, '低': 1 };
      return p[b.priority] - p[a.priority];
    });

    sorted.forEach((item, index) => {
      md += `### ${index + 1}. [优先级：${item.priority}] ${item.issue}\n`;
      md += `- **影响文件**: \`${item.file}:${item.line}\`\n`;
      md += `- **建议**: ${item.suggestion}\n`;
      md += `- **代码片段**:\n  \`\`\`tsx\n  ${item.snippet}\n  \`\`\`\n\n`;
    });
  }

  return md;
}

function saveReport(reportContent) {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];
  const historyFile = path.join(HISTORY_DIR, `${dateStr}.md`);

  // 保存到最新和历史
  fs.writeFileSync(OUTPUT_FILE, reportContent, 'utf-8');
  fs.writeFileSync(historyFile, reportContent, 'utf-8');
  
  console.log(`UI/UX 审计完成，报告已保存至：\n1. ${OUTPUT_FILE}\n2. ${historyFile}`);
}

const findings = runAudit();
const report = generateReport(findings);
saveReport(report);
