const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relPath) => fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const cascadeSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'customThemeCascadeDelete.js'), 'utf8');
const gatewaySource = read('src/components/modules/english/tabs/dashboard/ThemeGateway.tsx');
const trainingApiSource = read('src/services/trainingAPI.ts');
const taskContextSource = read('src/components/TaskContext.tsx');
const dashboardSource = read('src/components/modules/english/tabs/DashboardTab.tsx');

// 1. 后端级联删除核心 + 同步/异步入口
assert.match(cascadeSource, /function cascadeDeleteCustomTheme/, '缺少级联删除核心实现');
assert.match(cascadeSource, /vocabularyDeleted/, '级联必须清理词库');
assert.match(cascadeSource, /generationDeleted/, '级联必须清理 generation_history');
assert.match(cascadeSource, /attemptsDeleted/, '级联必须清理 training_attempts');
assert.match(cascadeSource, /SYSTEM_THEME_VALUES/, '级联必须维护系统主题保护名单');
assert.match(cascadeSource, /Custom Theme Extract|custom\\s\*theme\\s\*extract/i, '词条删除须限制自定义萃取来源');
assert.match(serverSource, /themeSnapshotForTask/, '异步失败路径须保留可恢复快照');
assert.match(serverSource, /app\.delete\('\/api\/theme\/custom\/:id'/, '缺少同步删除端点');
assert.match(serverSource, /app\.post\('\/api\/theme\/custom\/:id\/delete-async'/, '缺少异步删除端点');
assert.match(serverSource, /runCustomThemeCascadeDelete/, '同步/异步必须复用同一级联实现');
assert.match(serverSource, /createTask\(\s*'theme_delete'/, '异步删除必须登记 theme_delete 任务');
assert.match(serverSource, /正在清理该场景下的学习资料与练习记录/, '任务日志须使用业务语言');

// 2. 前端 3 秒竞速 → 任务中心
assert.match(trainingApiSource, /THEME_DELETE_RACE_MS = 3000/, '必须保留 3 秒竞速阈值');
assert.match(trainingApiSource, /withThemeDeleteTimeout/, '必须提供删除竞速包装');
assert.match(trainingApiSource, /deleteCustomThemeAsync/, '必须提供异步删除 API');
assert.match(gatewaySource, /withThemeDeleteTimeout\(action, THEME_DELETE_RACE_MS\)/, 'ThemeGateway 必须走 3 秒竞速');
assert.match(gatewaySource, /deleteCustomThemeAsync\(snapshot\.id\)/, '超时后必须转入异步删除');
assert.match(gatewaySource, /alreadyDeleted \|\| !queued\.taskId/, '超时后若同步已完成须按成功收口，避免误恢复');
assert.match(serverSource, /alreadyDeleted:\s*true/, '异步入口在主题已不存在时须返回 alreadyDeleted');
assert.match(gatewaySource, /type: 'theme_delete'/, '超时任务必须登记到任务中心');
assert.match(gatewaySource, /任务中心/, '超时提示必须引导用户前往任务中心');
assert.match(gatewaySource, /乐观移除|setCustomThemes\(\(prev\) => prev\.filter/, '必须乐观移除下拉项');
assert.match(gatewaySource, /已恢复该场景选项/, '同步失败必须可恢复选项');

// 3. 任务中心类型与完成后的刷新/恢复
assert.match(taskContextSource, /theme_delete/, 'TaskItem 类型必须包含 theme_delete');
assert.match(taskContextSource, /custom-theme-delete-finished/, '任务终态必须派发自定义事件');
assert.match(dashboardSource, /custom-theme-delete-finished/, 'Dashboard 必须监听删除完成事件');
assert.match(dashboardSource, /已恢复该场景选项/, '后台失败必须恢复场景选项');

console.log('custom theme cascade delete contract tests passed');
