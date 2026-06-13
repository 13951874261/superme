/**
 * 获取当前持久化的画像
 */
export function getUserCurrentProfile(): string {
  try {
    const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
    if (!raw) return '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.join('; ');
      }
    }
    return raw;
  } catch (e) {
    return localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  }
}

/**
 * 保存画像并向全局广播状态同步事件
 */
export function saveUserCurrentProfile(profile: string) {
  localStorage.setItem('user_current_profile', profile);
  localStorage.setItem('User_Current_Profile', profile);
  window.dispatchEvent(new Event('global-profile-changed'));
}

/**
 * 智能分析提问或上下文，发现英国/美国画像指令时自动执行隐式更新
 */
export function updateProfileFromText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // 匹配英国 (UK) 信号
  if (
    lower.includes("切换为英国") || 
    lower.includes("切换为英音") || 
    lower.includes("英国(uk)") || 
    lower.includes("英国 (uk)") ||
    lower.includes("[profile: uk]") ||
    lower.includes("[profile: 英国]") ||
    (lower.includes("英国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "英国 (UK)") {
      saveUserCurrentProfile("英国 (UK)");
      return true;
    }
  }
  
  // 匹配美国 (US) 信号
  if (
    lower.includes("切换为美国") || 
    lower.includes("切换为美音") || 
    lower.includes("美国(us)") || 
    lower.includes("美国 (us)") ||
    lower.includes("[profile: us]") ||
    lower.includes("[profile: 美国]") ||
    (lower.includes("美国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "美国 (US)") {
      saveUserCurrentProfile("美国 (US)");
      return true;
    }
  }
  
  return false;
}

/**
 * 遍历并分析大模型返回的所有字符串，实现隐式自适应学习
 */
export function interceptOutputText(output: any): void {
  if (!output) return;
  if (typeof output === 'string') {
    updateProfileFromText(output);
  } else if (typeof output === 'object') {
    for (const key in output) {
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        const val = output[key];
        if (typeof val === 'string') {
          updateProfileFromText(val);
        } else if (val && typeof val === 'object') {
          interceptOutputText(val);
        }
      }
    }
  }
}

/**
 * 包装并注入当前画像到 Dify 请求体中
 */
export function injectUserProfile(inputs: Record<string, any> = {}): Record<string, any> {
  for (const key in inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, key) && typeof inputs[key] === 'string') {
      updateProfileFromText(inputs[key]);
    }
  }
  
  const profile = getUserCurrentProfile();
  return {
    ...inputs,
    user_current_profile: profile,
  };
}
