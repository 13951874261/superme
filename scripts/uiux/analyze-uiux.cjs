const fs = require("fs");
const path = require("path");

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (name.includes("node_modules") || name.includes(".git") || name.includes("dist")) {
      continue;
    }
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, fileList);
    } else {
      const ext = path.extname(name);
      if ([".tsx", ".ts", ".vue", ".css", ".html"].includes(ext)) {
        fileList.push(name);
      }
    }
  }
  return fileList;
}

function runAnalysis() {
  const rootDir = path.resolve(__dirname, "../../");
  const srcDir = path.join(rootDir, "src");
  const files = getFiles(srcDir);
  
  const findings = [];
  let totalFilesScanned = files.length;

  const rules = [
    {
      id: "touch-target",
      name: "触控目标尺寸 (Touch Target)",
      severity: "High",
      points: 8,
      desc: "可点按元素尺寸过小，在移动设备上难以点击。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("<button") || line.includes("onClick")) {
          const smallTailwind = /\b(h-[5678]|w-[5678]|py?-[01]|p-[01])\b/.test(line);
          const smallInline = /height:\s*['"]?[1-3][0-9]px['"]?/.test(line);
          if (smallTailwind || smallInline) {
            return {
              file: filePath,
              lineNum,
              text: line.trim(),
              detail: "按钮或可点按区域高度/边距过小（可能小于建议的 44px 触控高度）。"
            };
          }
        }
        return null;
      }
    },
    {
      id: "contrast",
      name: "颜色对比度与可读性 (Contrast)",
      severity: "High",
      points: 7,
      desc: "低对比度文本（如白底灰字）严重降低可读性，特别是对弱视人群。",
      check: (content, filePath, line, lineNum) => {
        if (/text-(gray|slate|zinc|stone)-300/.test(line) && /bg-(white|gray-50|slate-50)/.test(line)) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "检测到低对比度色彩搭配（如 bg-white 配合 text-gray-300），建议使用 text-gray-600 或更深颜色。"
          };
        }
        return null;
      }
    },
    {
      id: "accessibility",
      name: "可访问性标识缺失 (Accessibility/A11y)",
      severity: "Medium",
      points: 5,
      desc: "图像缺失 alt 属性，或仅包含图标的按钮缺失 aria-label，导致屏幕阅读器无法理解。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("<img") && !line.includes("alt=")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "<img> 标签缺失 alt 属性，无障碍环境无法识别图片内容。"
          };
        }
        if (line.includes("<button") && !line.includes("aria-label") && !line.includes("aria-labelledby")) {
          const hasIconOnly = /<[A-Z][a-zA-Z]*Icon\b/.test(line) || (line.includes("Icon") && !/>[^<\{]+</.test(line));
          if (hasIconOnly) {
            return {
              file: filePath,
              lineNum,
              text: line.trim(),
              detail: "纯图标按钮缺少 aria-label 属性，屏幕阅读器用户无法得知按钮作用。"
            };
          }
        }
        return null;
      }
    },
    {
      id: "layout-breakage",
      name: "布局固宽与断裂风险 (Layout Breakage)",
      severity: "Medium",
      points: 6,
      desc: "硬编码的大尺寸固定宽度，可能在小屏设备上导致水平溢出和页面截断。",
      check: (content, filePath, line, lineNum) => {
        const match = line.match(/\bw-\[(\d+)px\]/);
        if (match) {
          const width = parseInt(match[1]);
          if (width > 400 && !line.includes("max-w-") && !line.includes("md:") && !line.includes("lg:")) {
            return {
              file: filePath,
              lineNum,
              text: line.trim(),
              detail: `硬编码固定宽度 ${width}px 缺少响应式适配，建议使用 max-w- 或响应式前缀。`
            };
          }
        }
        return null;
      }
    },
    {
      id: "responsive",
      name: "响应式断点缺失 (Responsive)",
      severity: "High",
      points: 7,
      desc: "多列布局（如 grid 或 flex）缺乏移动端适配，会导致移动端内容拥挤不堪。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("grid-cols-") && !line.includes("grid-cols-1") && !line.includes("sm:") && !line.includes("md:")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "定义了多列网格 (grid-cols)，但缺少移动优先的 grid-cols-1 或响应式断点前缀。"
          };
        }
        return null;
      }
    },
    {
      id: "consistency",
      name: "视觉一致性偏差 (Visual Consistency)",
      severity: "Low",
      points: 3,
      desc: "混合使用不协调的圆角、阴影或间距，使得界面显得零碎且不够专业。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("rounded-sm") && line.includes("rounded-lg")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "同一上下文中混合使用了 rounded-sm 和 rounded-lg，破坏了卡片或按钮的圆角一致性。"
          };
        }
        return null;
      }
    },
    {
      id: "feedback",
      name: "异步加载反馈缺失 (Feedback/Loading States)",
      severity: "Medium",
      points: 5,
      desc: "提交表单或触发异步接口时没有加载动画或禁用状态，用户重复点击可能导致重复提交和卡顿体验。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("onClick={async") && !line.includes("disabled") && !line.includes("loading")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "按钮绑定了异步 onClick 函数，但缺少 disabled 状态或 loading 旋转动画，存在重复提交风险。"
          };
        }
        return null;
      }
    },
    {
      id: "hover-transition",
      name: "动态微交互骤变 (Transition/Hover)",
      severity: "Low",
      points: 2,
      desc: "悬停状态没有过渡动画，导致视觉上瞬间突变，交互生硬。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("hover:") && !line.includes("transition") && !line.includes("duration-")) {
          if (line.includes("className=")) {
            return {
              file: filePath,
              lineNum,
              text: line.trim(),
              detail: "设置了 hover 伪类，但缺少 transition-all 或 transition-colors 过渡动画类，鼠标悬停变化生硬。"
            };
          }
        }
        return null;
      }
    },
    {
      id: "ai-slop",
      name: "模版化 AI 风格 (AI Gradient Slop)",
      severity: "Low",
      points: 3,
      desc: "滥用 AI 生成网站常见的深色紫/蓝渐变或大范围玻璃拟态，使设计显得廉价和千篇一律。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes("from-purple-") && line.includes("to-indigo-")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "使用了高频雷同的紫蓝渐变色背景（AI 模板常见套路），建议改用符合品牌基调的精细纯色或更有质感的色彩层次。"
          };
        }
        return null;
      }
    },
    {
      id: "focus-visibility",
      name: "键盘焦点可见性缺失 (Focus Visibility)",
      severity: "Medium",
      points: 4,
      desc: "移除了默认焦点轮廓，但未提供自定义焦点轮廓，导致键盘导航用户迷失位置。",
      check: (content, filePath, line, lineNum) => {
        if ((line.includes("focus:outline-none") || line.includes("outline-none")) && !line.includes("focus:ring") && !line.includes("focus-visible:ring")) {
          if (line.includes("<input") || line.includes("<button") || line.includes("<textarea")) {
            return {
              file: filePath,
              lineNum,
              text: line.trim(),
              detail: "使用了 focus:outline-none 移除了输入或按钮的默认焦点边框，但缺少自定义 focus-visible:ring，对键盘导航极不友好。"
            };
          }
        }
        return null;
      }
    },
    {
      id: "spacing-hierarchy",
      name: "间距与排版层级偏差 (Spacing & Hierarchy)",
      severity: "Low",
      points: 2,
      desc: "标题与段落缺少明显的间距或字体粗细差异，导致信息层级不明显，阅读费力。",
      check: (content, filePath, line, lineNum) => {
        if (/<h[123]\b/.test(line) && !line.includes("font-bold") && !line.includes("font-semibold") && !line.includes("text-") && line.includes("className=")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "标题元素缺少粗体或显式字号声明，与正文界限模糊，破坏了清晰的信息层级规划。"
          };
        }
        return null;
      }
    },
    {
      id: "empty-states",
      name: "空状态与边界处理缺失 (Empty States)",
      severity: "Medium",
      points: 4,
      desc: "列表渲染时未提供空状态模板，如果数据为空，界面会显示一片空白，容易让用户误以为加载失败。",
      check: (content, filePath, line, lineNum) => {
        if (line.includes(".map(") && !content.includes(".length === 0") && !content.includes("|| null") && !content.includes("length > 0")) {
          return {
            file: filePath,
            lineNum,
            text: line.trim(),
            detail: "发现直接使用 .map() 渲染列表，但该文件内缺少对空数组/空状态的展示处理，易给用户空白无反馈的负面体验。"
          };
        }
        return null;
      }
    }
  ];

  for (const file of files) {
    const relativePath = path.relative(rootDir, file).replace(/\\/g, "/");
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch (e) {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      for (const rule of rules) {
        const hit = rule.check(content, relativePath, line, lineNum);
        if (hit) {
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            points: rule.points,
            ...hit
          });
        }
      }
    }
  }

  const aggregated = {};
  for (const f of findings) {
    const key = f.ruleId;
    if (!aggregated[key]) {
      aggregated[key] = {
        ruleName: f.ruleName,
        severity: f.severity,
        desc: rules.find(r => r.id === key).desc,
        points: f.points,
        occurrences: []
      };
    }
    if (aggregated[key].occurrences.length < 3) {
      aggregated[key].occurrences.push(f);
    }
  }

  const sortedRules = Object.keys(aggregated)
    .map(key => ({ id: key, ...aggregated[key] }))
    .sort((a, b) => b.points - a.points);

  const finalSuggestions = sortedRules.slice(0, 5);

  let vibe = "React + Tailwind CSS 开发的高端交互界面";
  if (files.some(f => f.includes("vocab-server"))) {
    vibe += " (含辅助 Node.js 服务后端)";
  }
  const designRead = `Reading this as: React frontend application for english learning & translation assistant, with a modern Tailwind-driven design system, leaning toward visual interactive panels and Ebbinghaus memorization modules.`;

  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 19);
  let md = `# UI/UX 改进建议 — ${dateStr.split(" ")[0]}

> **重要提示：** 本分析根据项目内 AGENTS.md 中指定的风格准则及前端品位技能库（含 \`design-taste-frontend\` 与 \`impeccable\` 等）进行静态启发式扫描，旨在不改动任何业务逻辑的前提下，提升产品的视觉精致度与易用性。

## 元数据统计
- **分析时间：** ${dateStr} (CST)
- **覆盖前端文件数：** ${totalFilesScanned} 个 (\`.tsx, .ts, .vue, .css\`)
- **建议改进条目：** ${finalSuggestions.length} 条最关键建议
- **品位设定参考：** \`DESIGN_VARIANCE: 7\`, \`MOTION_INTENSITY: 6\`, \`VISUAL_DENSITY: 4\`

---

## 品牌与设计语境推断 (Design Read)
*\`${designRead}\`*

---

`;

  if (finalSuggestions.length === 0) {
    md += "### 🎉 未检测到明显的 UI/UX 问题！界面符合高标准品位要求。\n";
  } else {
    finalSuggestions.forEach((s, idx) => {
      md += `## ${idx + 1}. [${s.severity}] ${s.ruleName}

- **问题描述：** ${s.desc}
- **典型涉及文件及行号：**
`;
      s.occurrences.forEach(occ => {
        md += `  - [\`${occ.file}#L${occ.lineNum}\`](${occ.file}#L${occ.lineNum}): \`\`\`${occ.text.substring(0, 120)}\`\`\`\n    *具体问题：${occ.detail}*\n`;
      });

      md += `
- **具体实施方案：**
  1. **检查定位**：打开上述受影响文件，定位到对应行，检查是否有影响局部间距或结构的外层包裹块。
  2. **调整样式（不可影响业务逻辑）**：
     - 若为触控或间距问题，适当调大 padding/gap，或定义 \`min-width\`/\`min-height\`（例如 44px），切勿改变任何 \`onClick\` 事件处理器的逻辑。
     - 若为对比度或 AI 模板渐变问题，调整 Tailwind 色值，将其微调为符合该界面整体调性的精细渐变或实色。
     - 若为 Loading 或 Focus 状态，补充 \`disabled={loading}\` 或 \`focus-visible:ring-2 focus-visible:ring-indigo-500\` 等无障碍交互类。
  3. **适配验证**：在 Chrome DevTools 的移动设备模拟器（如 iPhone SE & iPad）上验证不同断点在调整后能够完美流式布局，不会断裂或溢出。

- **影响评估：**
  - **组件范围**：仅限对应的 CSS 类名及局部无障碍属性 (aria-label/alt)，无副作用。
  - **业务逻辑**：零侵入，所有 React 状态、生命周期和事件处理器保持 100% 不变。
  - **回归测试**：刷新页面，确保组件在 hover、focus 和移动端视口下的视觉稳定性。

---
`;
    });
  }

  console.log(md);
}

runAnalysis();
