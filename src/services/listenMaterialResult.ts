export function resolveListenMaterialText(result: unknown): string | null {
  if (typeof result === 'string') {
    const text = result.trim();
    return text ? text : null;
  }
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  for (const key of ['script', 'answer', 'content'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function extractListenMaterialTaskId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const taskId = (result as { taskId?: unknown }).taskId;
  return typeof taskId === 'string' && taskId.trim() ? taskId.trim() : null;
}

export async function pollTaskResultContent(
  taskId: string,
  options?: {
    fetchImpl?: typeof fetch;
    intervalMs?: number;
    maxAttempts?: number;
  },
): Promise<string> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 90;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetchImpl(`/api/tasks/${taskId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `任务查询失败 (HTTP ${res.status})`);
    }
    if (data.status === 'completed') {
      const text = resolveListenMaterialText(data.result) ?? resolveListenMaterialText(data);
      if (!text) throw new Error('任务已完成但未返回正文');
      return text;
    }
    if (data.status === 'failed') {
      throw new Error(data.error || '后台生成失败');
    }
    if (attempt < maxAttempts - 1 && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error('生成超时，请稍后重试');
}
