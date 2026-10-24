/**
 * FV-PROFILE-01：顶栏 Evolution 与侧栏 Career 共用 superme_career。
 * 运行：node vocab-server/tests/careerProgressionFrontend.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const header = fs.readFileSync(path.join(root, 'src/components/Header.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'src/components/Sidebar.tsx'), 'utf8');

assert.match(header, /from ['"]\.\.\/utils\/careerProgression['"]/, 'Header 必须读共享画像');
assert.match(sidebar, /from ['"]\.\.\/utils\/careerProgression['"]/, 'Sidebar 必须写共享画像');
assert.match(header, /CAREER_CHANGED_EVENT/, '侧栏保存后顶栏必须监听变更');
assert.match(sidebar, /saveCareerPathForAccount|syncCareerToServer/, '侧栏保存必须同步账号 career');
assert.doesNotMatch(header, /支行副行长/, '顶栏不得写死支行副行长');
assert.doesNotMatch(header, /width:\s*'45%'/, '顶栏进度不得写死 45%');

const profileHelper = fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8');
assert.match(profileHelper, /formatCareerProfileLine|buildCareerAwareProfileString/, 'inject 必须带职业路径');
assert.match(profileHelper, /getInjectedUserCurrentProfile/, '须提供完整注入串辅助函数');

const difyApi = fs.readFileSync(path.join(root, 'src/services/difyAPI.ts'), 'utf8');
assert.match(difyApi, /getInjectedUserCurrentProfile/, 'difyAPI 须使用完整注入');
assert.doesNotMatch(
  difyApi,
  /user_current_profile:\s*getUserCurrentProfile\(\)/,
  'difyAPI 不得裸传 getUserCurrentProfile 作为 user_current_profile',
);

const settings = fs.readFileSync(path.join(root, 'src/components/GlobalSettingsPanel.tsx'), 'utf8');
assert.match(settings, /UserProfileOverlay/);
assert.match(settings, /setIsOpen\(false\)/);
const overlay = fs.readFileSync(path.join(root, 'src/components/UserProfileOverlay.tsx'), 'utf8');
assert.match(overlay, /compressUserProfile/);
assert.match(overlay, /loadUserProfileFromServer/, '打开画像前必须强制拉取服务端');
assert.match(overlay, /saveCareerPathForAccount/);
assert.match(overlay, /buildStaticDifyProfilePreview|buildCareerAwareProfileString/, '注入预览必须含职业/静态拼接');
assert.match(overlay, /画像正文来源/, '须展示写入来源说明 E1');
assert.match(overlay, /L3 结构化变量/);
assert.match(overlay, /错题账本摘要/);
assert.match(overlay, /关系图谱摘要/);
assert.match(profileHelper, /buildStaticDifyProfilePreview/, '须提供静态注入预览辅助函数');

const chatbot = fs.readFileSync(path.join(root, 'src/utils/difyChatbot.ts'), 'utf8');
assert.match(chatbot, /getInjectedUserCurrentProfile/, 'Chat 嵌入须用完整注入画像');
assert.match(chatbot, /delete inputs\.memory_pack/, 'B1：超长须先能删除 memory_pack');
const packIdx = chatbot.indexOf('delete inputs.memory_pack');
const profileDelIdx = chatbot.indexOf('delete inputs.user_current_profile');
assert.ok(packIdx >= 0 && profileDelIdx >= 0 && packIdx < profileDelIdx, 'B1：须先砍 pack 再删 profile');

console.log('OK careerProgression frontend contract');
