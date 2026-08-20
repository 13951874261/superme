import { getAppUserId } from '../utils/profileHelper';

export type DailyCronModuleStats = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  running: number;
};

export type DailyCronRunSummary = {
  id: string;
  type: 'daily_cron';
  name: string;
  packDate: string;
  cronTickId: string;
  userId: string;
  triggerSource: string;
  parentRunId?: string | null;
  status: string;
  executionStatus: string;
  auditHealth: string;
  progress: number;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
  modules: {
    wakeup: DailyCronModuleStats;
    flaw: DailyCronModuleStats;
    long_article: DailyCronModuleStats;
    listen: DailyCronModuleStats;
  };
};

export type DailyCronInputSource = {
  name: string;
  value: unknown;
  valuePreview?: string;
  sensitive?: boolean;
  friendlyDescription?: string;
  technicalDetails?: {
    sourceType?: string;
    sourceRef?: string;
    queryRule?: string;
    transform?: string;
    fallback?: string;
  };
};

export type DailyCronStep = {
  id: string;
  module: string;
  comboKey?: string | null;
  status: string;
  progress: number;
  error?: string | null;
  inputs?: Record<string, unknown> | null;
  inputSources?: DailyCronInputSource[] | null;
  resultSummary?: unknown;
  startedAt?: number;
  finishedAt?: number;
};

export type DailyCronRunDetail = {
  run: DailyCronRunSummary;
  steps: DailyCronStep[];
  events: Array<{
    id: string;
    stepId?: string | null;
    level: string;
    message: string;
    context?: unknown;
    createdAt: number;
  }>;
};

export async function fetchDailyCronRuns(days = 7, userId = getAppUserId()): Promise<DailyCronRunSummary[]> {
  const res = await fetch(`/api/daily-cron/runs?userId=${encodeURIComponent(userId)}&days=${days}`);
  if (!res.ok) throw new Error(`daily-cron runs HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'fetch runs failed');
  return Array.isArray(data.runs) ? data.runs : [];
}

export async function fetchDailyCronRunDetail(runId: string, userId = getAppUserId()): Promise<DailyCronRunDetail> {
  const res = await fetch(`/api/daily-cron/runs/${encodeURIComponent(runId)}?userId=${encodeURIComponent(userId)}`);
  if (res.status === 404) throw new Error('not found');
  if (!res.ok) throw new Error(`daily-cron detail HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'fetch detail failed');
  return data as DailyCronRunDetail;
}

export async function rerunDailyCronRun(
  runId: string,
  mode: 'all_current' | 'failed_snapshot',
  userId = getAppUserId(),
): Promise<{ runId: string }> {
  const res = await fetch(`/api/daily-cron/runs/${encodeURIComponent(runId)}/rerun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `rerun HTTP ${res.status}`);
  }
  return { runId: data.runId };
}

export async function deleteDailyCronRun(runId: string, userId = getAppUserId()): Promise<void> {
  const res = await fetch(
    `/api/daily-cron/runs/${encodeURIComponent(runId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (res.status === 404) return;
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) throw new Error(data.error || '进行中的任务不能删除');
  if (!res.ok || !data.success) throw new Error(data.error || `delete run HTTP ${res.status}`);
}

export async function clearFinishedDailyCronRuns(userId = getAppUserId()): Promise<{ deletedRuns: number }> {
  const res = await fetch('/api/daily-cron/runs/clear-finished', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `clear cron HTTP ${res.status}`);
  return { deletedRuns: Number(data.deletedRuns || 0) };
}
