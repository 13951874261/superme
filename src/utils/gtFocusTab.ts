export const GT_FOCUS_TAB_KEY = 'gt_focus_tab';
export const GT_FOCUS_TAB_SESSION = 'session';
export const GT_NAV_SESSION_EVENT = 'navigate-gametheory-session';

type FocusDeps = {
  sessionStorage?: Storage;
  win?: Window;
};

export function requestGameTheorySessionFocus(deps: FocusDeps = {}): void {
  const ss = deps.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const w = deps.win ?? (typeof window !== 'undefined' ? window : undefined);
  ss?.setItem(GT_FOCUS_TAB_KEY, GT_FOCUS_TAB_SESSION);
  if (w) {
    w.dispatchEvent(new CustomEvent(GT_NAV_SESSION_EVENT));
  }
}

/** @returns true 表示应切换到 session Tab */
export function consumeGameTheorySessionFocus(deps: FocusDeps = {}): boolean {
  const ss = deps.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!ss) return false;
  const raw = ss.getItem(GT_FOCUS_TAB_KEY);
  ss.removeItem(GT_FOCUS_TAB_KEY);
  return raw === GT_FOCUS_TAB_SESSION;
}
