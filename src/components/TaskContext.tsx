import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { fetchDailyCronRuns, DailyCronRunSummary } from '../services/dailyCronAPI';
import { getAppUserId } from '../utils/profileHelper';

export interface TaskItem {
  id: string;
  type: 'url' | 'video' | 'material' | 'tts' | 'game_theory' | 'listen_backfill' | 'vocab_export' | 'tactics_export' | 'vault_export' | 'vault_refine' | 'tactics_ingest' | 'insight_listen' | 'speak';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  error?: string | null;
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
  } | null;
}

interface TaskContextType {
  tasks: TaskItem[];
  cronRuns: DailyCronRunSummary[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addTask: (task: TaskItem) => void;
  startPolling: (id: string) => void;
  fetchTasks: () => Promise<void>;
  fetchCronRuns: () => Promise<void>;
  pendingCount: number;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const API_BASE = '';

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [cronRuns, setCronRuns] = useState<DailyCronRunSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const activePolls = useRef<Set<string>>(new Set());
  const lastGlobalPollTimeRef = useRef<number>(0);

  const fetchCronRuns = useCallback(async () => {
    try {
      const runs = await fetchDailyCronRuns(7, getAppUserId());
      setCronRuns(runs);
    } catch (e) {
      console.error('Failed to fetch daily cron runs:', e);
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks`);
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
    setTasks((prev) => [task, ...prev]);
    if (task.status === 'pending' || task.status === 'running') {
      startPolling(task.id);
    }
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

      try {
        const response = await fetch(`${API_BASE}/api/tasks/${id}`);
        if (!response.ok) {
          throw new Error('Task fetch failed');
        }
        const data = await response.json();
        if (data.success) {
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
                  }
                : t
            )
          );

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            activePolls.current.delete(id);
            if (data.status === 'completed') {
              window.dispatchEvent(new CustomEvent('vocab-updated'));
              if (data.type === 'material' || data.type === 'vault_refine') {
                window.dispatchEvent(new CustomEvent('knowledge-vault-updated'));
              }
              if (data.type === 'tactics_ingest') {
                window.dispatchEvent(new CustomEvent('tactics-ingest-updated'));
              }

              if (data.result && (data.result.article || data.result.words)) {
                const result = data.result;
                const taskName = data.name || data.taskName || '未命名材料';

                localStorage.setItem('super_agent_last_generated_article', result.article || '');
                localStorage.setItem('super_agent_last_generated_words', JSON.stringify(result.words || []));
                localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(result.phrases || []));
                localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(result.sentences || []));
                localStorage.setItem('super_agent_intel_source', `材料提纯: ${taskName}`);

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

              if (data.type === 'video' && data.result?.content) {
                window.dispatchEvent(new CustomEvent('import-virtual-material', {
                  detail: {
                    name: data.result.name,
                    content: data.result.content,
                    mimeType: data.result.mimeType,
                  }
                }));
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error polling task ${id}:`, e);
        clearInterval(interval);
        activePolls.current.delete(id);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'failed',
                  error: '轮询任务状态失败，网络连接中断',
                }
              : t
          )
        );
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
        isOpen,
        setIsOpen,
        addTask,
        startPolling,
        fetchTasks,
        fetchCronRuns,
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
