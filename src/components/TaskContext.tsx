import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchDailyCronRuns, DailyCronRunSummary, deleteDailyCronRun, clearFinishedDailyCronRuns } from '../services/dailyCronAPI';
import { getAppUserId } from '../utils/profileHelper';

export interface TaskItem {
  id: string;
  type: 'url' | 'video' | 'material' | 'tts' | 'game_theory' | 'listen_backfill' | 'vocab_export' | 'tactics_export' | 'vault_export' | 'vault_refine' | 'tactics_ingest' | 'insight_listen' | 'insight_case_backfill' | 'insight_daily_cron' | 'speak' | 'vocab_add' | 'theme_delete' | 'daily_extract';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  error?: string | null;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  result?: {
    name?: string;
    content?: string;
    mimeType?: string;
    encoding?: string;
    sourceType?: string;
    sourceUrl?: string;
    audioUrl?: string;
    audioId?: string;
    historyId?: string;
    article?: string;
    words?: unknown[];
    phrases?: unknown[];
    sentences?: unknown[];
    feedback?: string;
    scenarioText?: string;
    score?: number;
    critique?: string;
    framework_analysis?: string;
    revised_version?: string;
    knowledgeReminder?: string;
    mediaId?: string;
    videoUrl?: string;
    transcript?: string;
    inserted?: number;
    sourceName?: string;
    themeSnapshot?: {
      id?: string;
      themeName?: string;
      displayName?: string;
      associatedFile?: string;
      difyDocumentId?: string;
      difyDatasetId?: string;
      extractedKeywords?: unknown;
      createdAt?: number;
      [key: string]: unknown;
    };
    message?: string;
    alreadyDeleted?: boolean;
  } | null;
}

interface TaskContextType {
  tasks: TaskItem[];
  cronRuns: DailyCronRunSummary[];
  hiddenCronCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addTask: (task: TaskItem) => void;
  startPolling: (id: string) => void;
  fetchTasks: () => Promise<void>;
  fetchCronRuns: () => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteCronRun: (id: string) => Promise<void>;
  clearFinished: () => Promise<{ deletedTasks: number; deletedCronRuns: number }>;
  pendingCount: number;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const POLL_REQUEST_TIMEOUT_MS = 10_000;
const POLL_MAX_TRANSIENT_FAILURES = 6;

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [cronRuns, setCronRuns] = useState<DailyCronRunSummary[]>([]);
  const [hiddenCronCount, setHiddenCronCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const activePolls = useRef<Set<string>>(new Set());
  const transientFailuresRef = useRef<Map<string, number>>(new Map());
  const lastGlobalPollTimeRef = useRef<number>(0);

  const fetchCronRuns = useCallback(async () => {
    try {
      const data = await fetchDailyCronRuns(7, getAppUserId());
      setCronRuns(data.runs);
      setHiddenCronCount(data.hiddenCount);
    } catch (e) {
      console.error('Failed to fetch daily cron runs:', e);
    }
  }, []);

  const fetchTasks = async () => {
    const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), POLL_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_BASE}/api/tasks`, { signal: controller.signal });
        clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          data.tasks.forEach((task: TaskItem) => {
            if ((task.status === 'pending' || task.status === 'running') && !activePolls.current.has(task.id)) {
              startPolling(task.id);
            }
          });
        }
      }
    } catch (e) {
      clearTimeout(timer);
      console.error('Failed to fetch tasks:', e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchCronRuns();
  }, [fetchCronRuns]);

  useEffect(() => {
    if (!isOpen) return;
    fetchCronRuns();
    const t = setInterval(() => {
      fetchCronRuns();
    }, 5000);
    return () => clearInterval(t);
  }, [isOpen, fetchCronRuns]);

  const addTask = (task: TaskItem) => {
    const now = Date.now();
    const normalized = {
      ...task,
      createdAt: task.createdAt ?? now,
      updatedAt: task.updatedAt ?? now,
    };
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === normalized.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...normalized };
        return next;
      }
      return [normalized, ...prev];
    });
    if (normalized.status === 'pending' || normalized.status === 'running') {
      startPolling(normalized.id);
    }
  };

  const deleteTask = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.status === 404) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      await fetchTasks();
      throw new Error(data.error || '进行中的任务不能删除');
    }
    if (!res.ok || !data.success) throw new Error(data.error || `delete task HTTP ${res.status}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    activePolls.current.delete(id);
  };

  const deleteCronRun = async (id: string) => {
    try {
      await deleteDailyCronRun(id);
    } catch (e: any) {
      if (String(e?.message || '').includes('进行中')) {
        await fetchCronRuns();
      }
      throw e;
    }
    setCronRuns((prev) => prev.filter((r) => r.id !== id));
  };

  const clearFinished = async () => {
    let deletedTasks = 0;
    let deletedCronRuns = 0;
    const errors: string[] = [];

    try {
      const res = await fetch(`${API_BASE}/api/tasks/clear-finished`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) errors.push(data.error || '清空普通任务失败');
      else deletedTasks = Number(data.deleted || 0);
    } catch (e: any) {
      errors.push(e.message || '清空普通任务失败');
    }

    try {
      const r = await clearFinishedDailyCronRuns();
      deletedCronRuns = r.deletedRuns;
    } catch (e: any) {
      errors.push(e.message || '清空定时任务失败');
    }

    await Promise.all([fetchTasks(), fetchCronRuns()]);

    if (errors.length) {
      throw new Error(
        `已删除普通任务 ${deletedTasks} 条、定时任务 ${deletedCronRuns} 条。失败：${errors.join('；')}`
      );
    }
    return { deletedTasks, deletedCronRuns };
  };

  const startPolling = (id: string) => {
    if (activePolls.current.has(id)) return;
    activePolls.current.add(id);

    const interval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastGlobalPollTimeRef.current < 1000) {
        return;
      }
      lastGlobalPollTimeRef.current = now;

      const pollController = new AbortController();
      const pollTimer = setTimeout(() => pollController.abort(), POLL_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_BASE}/api/tasks/${id}`, { signal: pollController.signal });
        clearTimeout(pollTimer);
        if (!response.ok) {
          throw new Error('Task fetch failed');
        }
        const data = await response.json();
        if (data.success) {
          transientFailuresRef.current.delete(id);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: data.status,
                    progress: data.progress,
                    logs: data.logs,
                    error: data.error,
                    result: data.result,
                    createdAt: data.createdAt ?? t.createdAt,
                    updatedAt: data.updatedAt ?? t.updatedAt,
                    completedAt: data.completedAt ?? t.completedAt,
                  }
                : t
            )
          );

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            activePolls.current.delete(id);
            transientFailuresRef.current.delete(id);
            if (data.type === 'theme_delete') {
              window.dispatchEvent(new CustomEvent('custom-theme-delete-finished', {
                detail: {
                  status: data.status,
                  error: data.error,
                  themeSnapshot: data.result?.themeSnapshot || null,
                  message: data.result?.message || data.error || null,
                },
              }));
            }
            if (data.status === 'completed') {
              window.dispatchEvent(new CustomEvent('vocab-updated'));
              if (data.type === 'material' || data.type === 'vault_refine') {
                window.dispatchEvent(new CustomEvent('knowledge-vault-updated'));
              }
              if (data.type === 'tactics_ingest') {
                window.dispatchEvent(new CustomEvent('tactics-ingest-updated'));
              }

              const isMaterialLike = data.type === 'material' || data.type === 'video';
              if (isMaterialLike && data.result && (data.result.article || data.result.words || data.result.phrases || data.result.sentences || data.result.content || data.result.transcript)) {
                const result = data.result;
                const taskName = data.name || data.taskName || '未命名材料';
                const article = result.article || result.transcript || result.content || '';

                localStorage.setItem('super_agent_material_article', article);
                localStorage.setItem('super_agent_material_words', JSON.stringify(result.words || []));
                localStorage.setItem('super_agent_material_phrases', JSON.stringify(result.phrases || []));
                localStorage.setItem('super_agent_material_sentences', JSON.stringify(result.sentences || []));
                localStorage.setItem('super_agent_material_source', `材料整理: ${taskName}`);

                window.dispatchEvent(new CustomEvent('material-data-refreshed'));
                window.dispatchEvent(new CustomEvent('extraction-success', {
                  detail: {
                    source: 'material',
                    article,
                    words: result.words || [],
                    phrases: result.phrases || [],
                    sentences: result.sentences || [],
                  }
                }));
              } else if (!isMaterialLike && data.result && (data.result.article || data.result.words)) {
                const result = data.result;
                const taskName = data.name || data.taskName || '未命名材料';

                localStorage.setItem('super_agent_last_generated_article', result.article || '');
                localStorage.setItem('super_agent_last_generated_words', JSON.stringify(result.words || []));
                localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(result.phrases || []));
                localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(result.sentences || []));
                localStorage.setItem('super_agent_intel_source', `材料整理: ${taskName}`);

                window.dispatchEvent(new CustomEvent('intel-data-refreshed'));
                window.dispatchEvent(new CustomEvent('extraction-success', {
                  detail: {
                    article: result.article || '',
                    words: result.words || [],
                    phrases: result.phrases || [],
                    sentences: result.sentences || [],
                  }
                }));
              }
            }
          }
        }
      } catch (e) {
        const transientFailures = (transientFailuresRef.current.get(id) || 0) + 1;
        transientFailuresRef.current.set(id, transientFailures);
        console.warn(`Error polling task ${id} (transient failure ${transientFailures}/${POLL_MAX_TRANSIENT_FAILURES}):`, e);
        if (transientFailures >= POLL_MAX_TRANSIENT_FAILURES) {
          setTasks((prev) => prev.map((t) => (
            t.id === id && (t.status === 'pending' || t.status === 'running')
              ? { ...t, error: '任务状态暂时无法获取，系统将继续后台处理；请稍后刷新任务中心' }
              : t
          )));
        }
      }
    }, 5000);
  };

  const taskPending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length;
  const cronPending = cronRuns.filter((r) => r.status === 'pending' || r.status === 'running').length;
  const pendingCount = taskPending + cronPending;

  return (
    <TaskContext.Provider
      value={{
        tasks,
        cronRuns,
        hiddenCronCount,
        isOpen,
        setIsOpen,
        addTask,
        startPolling,
        fetchTasks,
        fetchCronRuns,
        deleteTask,
        deleteCronRun,
        clearFinished,
        pendingCount,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};
