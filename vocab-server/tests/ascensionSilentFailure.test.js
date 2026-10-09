const assert = require("assert");
const fs = require("fs");
const path = require("path");

const frontend = fs.readFileSync(path.join(__dirname, "../../src/components/modules/GameTheoryModule.tsx"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

// ---- 回归 1: 前端提交校验失败时必须设置可视化错误状态（不能只播声音就 return）----
// 反模式：playGentleWarning(); return;  （纯静默）
const silentReturnPattern = /playGentleWarning\(\);\s*\n\s*return;/;
const hasSilentReturn = silentReturnPattern.test(frontend);
assert.ok(!hasSilentReturn, "ascension 前端不能仅播放警告音就 return，必须设置可视化错误状态");

// 正向：必须存在 setAscError 或类似错误状态写入
assert.match(frontend, /setAscError|setError\s*\(|setSubmitError/, "前端缺少 ascension 可视化错误状态写入");

// ---- 回归 2: 后端必须校验每一层 why 字段非空 ----
// 当前代码只校验 layers.length < 5，但不校验 why 是否为空字符串
const ascRouteStart = server.indexOf("app.post('/api/game-theory/ascension'");
assert.ok(ascRouteStart > -1, "找不到 /api/game-theory/ascension 路由");
const ascRouteBody = server.slice(ascRouteStart, ascRouteStart + 1500);
const emptyWhyCheckPattern = /layers\.some|layers\.every|layers\.find|\.why\s*&&\s*l\.why\.trim\(\)\s*[!=]\s*['"]['"]|l\.why\.length|why.*empty|空.*层|层.*空/;
const hasEmptyWhyCheck = emptyWhyCheckPattern.test(ascRouteBody);
assert.ok(hasEmptyWhyCheck, "后端 ascension 必须校验每一层 why 字段非空，不能只校验数组长度");

console.log("ascension silent-failure regression tests passed");
