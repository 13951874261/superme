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

const settings = fs.readFileSync(path.join(root, 'src/components/GlobalSettingsPanel.tsx'), 'utf8');
assert.match(settings, /UserProfileOverlay/);
assert.match(settings, /setIsOpen\(false\)/);
const overlay = fs.readFileSync(path.join(root, 'src/components/UserProfileOverlay.tsx'), 'utf8');
assert.match(overlay, /compressUserProfile/);
assert.match(overlay, /saveCareerPathForAccount/);
assert.match(overlay, /buildCareerAwareProfileString/);

console.log('OK careerProgression frontend contract');
