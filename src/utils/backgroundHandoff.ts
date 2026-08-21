import { showToast } from '../components/Toast';
import { showNearHandoff } from '../components/NearHandoffNotice';

/** Header 任务中心按钮监听此事件做 GSAP 脉冲 */
export const TASK_CENTER_PULSE_EVENT = 'super-agent:task-center-pulse';

export type HandoffTone = 'success' | 'info' | 'error';

export interface BackgroundHandoffOptions {
  /** 触发操作的按钮/锚点；缺省则仅 Toast + 脉冲 */
  anchor?: HTMLElement | null;
  message: string;
  tone?: HandoffTone;
  /** 默认 true */
  toast?: boolean;
  /** 默认 true */
  pulse?: boolean;
  /** 就近浮层时长 ms，默认 3200 */
  nearDuration?: number;
  /** Toast 时长 ms，默认 4000 */
  toastDuration?: number;
}

let toastThrottleUntil = 0;
let toastBurstCount = 0;
let toastBurstMessage = '';
let toastBurstTimer: ReturnType<typeof setTimeout> | null = null;

export function emitTaskCenterPulse(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASK_CENTER_PULSE_EVENT));
}

/**
 * 统一后台 handoff 反馈：就近浮层（有锚点时）+ 全局 Toast + 任务中心脉冲。
 * 连续触发时 Toast 合并节流，就近提示每次仍可出现。
 */
export function notifyBackgroundHandoff(options: BackgroundHandoffOptions): void {
  const tone = options.tone || 'info';
  const message = (options.message || '').trim();
  if (!message) return;

  if (options.anchor) {
    showNearHandoff({
      anchor: options.anchor,
      message,
      tone,
      duration: options.nearDuration ?? 3200,
    });
  }

  if (options.toast !== false) {
    const now = Date.now();
    if (now < toastThrottleUntil && toastBurstMessage) {
      toastBurstCount += 1;
      if (toastBurstTimer) clearTimeout(toastBurstTimer);
      toastBurstTimer = setTimeout(() => {
        const summary =
          toastBurstCount > 1
            ? `${toastBurstMessage}（及另外 ${toastBurstCount - 1} 项）`
            : toastBurstMessage;
        showToast({
          message: summary,
          type: tone,
          duration: options.toastDuration ?? 4000,
        });
        toastBurstCount = 0;
        toastBurstMessage = '';
        toastBurstTimer = null;
      }, 450);
    } else {
      toastBurstCount = 1;
      toastBurstMessage = message;
      toastThrottleUntil = now + 1200;
      showToast({
        message,
        type: tone,
        duration: options.toastDuration ?? 4000,
      });
    }
  }

  if (options.pulse !== false) {
    emitTaskCenterPulse();
  }
}

/** 收录按钮文案（矩阵齐备前不得显示「已收录」） */
export const VOCAB_COLLECT_LABEL = {
  idle: '+ 收录',
  collecting: '收录中',
  queued: '后台处理中',
  done: '已收录',
} as const;
