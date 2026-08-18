/**
 * PERF-SLA-01 性能度量与轻量只读打点工具
 * 严格遵照 D:\cursor\work\super-agent\.omx\plans\prd-perf-sla-3s-10s.md 规范
 *
 * 阈值标准：
 * - L0: 交互反馈层 <= 3000ms（实际目标 < 300ms）
 * - L1: 普通 API 查询 <= 3000ms
 * - L2: 缓存命中渲染 <= 500ms
 * - L3: Dify 在线交互 <= 10000ms（主体在屏）
 * - L4: 重任务回执 <= 3000ms（入任务中心）
 */

export const SLA_THRESHOLDS = {
  L0_FEEDBACK_MS: 3000,
  L1_QUERY_MS: 3000,
  L2_CACHE_HIT_MS: 500,
  L3_SUBJECT_MS: 10000,
  L4_ENQUEUE_MS: 3000,
} as const;

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    import.meta.env.DEV ||
    localStorage.getItem('PERF_SLA_DEBUG') === '1' ||
    sessionStorage.getItem('PERF_SLA_DEBUG') === '1'
  );
}

/**
 * 启动一个 L0 交互计时器并在回调时度量反馈耗时
 */
export function startL0Timer(action: string): () => number {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return () => {
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = Math.round(t1 - t0);
    recordL0Feedback(action, duration);
    return duration;
  };
}

/**
 * 记录 L0 交互反馈耗时
 */
export function recordL0Feedback(action: string, durationMs: number): void {
  if (!isDebugEnabled()) return;
  const isOk = durationMs <= SLA_THRESHOLDS.L0_FEEDBACK_MS;
  const tag = isOk ? 'PASS' : 'SLA_BREACH';
  console.debug(
    `[PERF-SLA][L0-Feedback] ${tag} ${action}: ${durationMs}ms (Limit: ${SLA_THRESHOLDS.L0_FEEDBACK_MS}ms)`
  );
}

/**
 * 记录 L1 普通 API 响应耗时
 */
export function recordL1Response(action: string, durationMs: number, success: boolean = true): void {
  if (!isDebugEnabled()) return;
  const isOk = durationMs <= SLA_THRESHOLDS.L1_QUERY_MS;
  const tag = isOk && success ? 'PASS' : 'SLA_BREACH';
  console.debug(
    `[PERF-SLA][L1-Query] ${tag} ${action}: ${durationMs}ms (Limit: ${SLA_THRESHOLDS.L1_QUERY_MS}ms, Success: ${success})`
  );
}

/**
 * 记录 L2 预生成缓存命中耗时
 */
export function recordL2CacheHit(action: string, durationMs: number): void {
  if (!isDebugEnabled()) return;
  const isOk = durationMs <= SLA_THRESHOLDS.L2_CACHE_HIT_MS;
  const tag = isOk ? 'PASS' : 'SLA_BREACH';
  console.debug(
    `[PERF-SLA][L2-CacheHit] ${tag} ${action}: ${durationMs}ms (Limit: ${SLA_THRESHOLDS.L2_CACHE_HIT_MS}ms)`
  );
}

/**
 * 记录 L3 Dify 在线交互主体交付耗时
 */
export function recordL3Response(action: string, durationMs: number, isSubjectComplete: boolean = true): void {
  if (!isDebugEnabled()) return;
  const isOk = durationMs <= SLA_THRESHOLDS.L3_SUBJECT_MS && isSubjectComplete;
  const tag = isOk ? 'PASS' : 'SLA_BREACH';
  console.debug(
    `[PERF-SLA][L3-DifySubject] ${tag} ${action}: ${durationMs}ms (Limit: ${SLA_THRESHOLDS.L3_SUBJECT_MS}ms, Complete: ${isSubjectComplete})`
  );
}

/**
 * 记录 L4 重任务回执耗时
 */
export function recordL4TaskEnqueue(action: string, durationMs: number, taskId: string): void {
  if (!isDebugEnabled()) return;
  const isOk = durationMs <= SLA_THRESHOLDS.L4_ENQUEUE_MS;
  const tag = isOk ? 'PASS' : 'SLA_BREACH';
  console.debug(
    `[PERF-SLA][L4-TaskEnqueue] ${tag} ${action} -> taskId=${taskId}: ${durationMs}ms (Limit: ${SLA_THRESHOLDS.L4_ENQUEUE_MS}ms)`
  );
}
