import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface TaskItem {
  id: string;
  type: 'url' | 'video';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  error?: string | null;
  result?: {
    name: string;
    content: string;
    mimeType: string;
    sourceType: string;
    sourceUrl?: string;
  } | null;
}

interface TaskContextType {
  tasks: TaskItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addTask: (task: TaskItem) => void;
  startPolling: (id: string) => void;
  fetchTasks: () => Promise<void>;
  pendingCount: number;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const API_BASE = '';

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const activePolls = useRef<Set<string>>(new Set());

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          // 自动重连轮询那些尚未完成的后台任务
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
  }, []);

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
              // 触发自定义事件通知词本更新
              window.dispatchEvent(new CustomEvent('vocab-updated'));
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
    }, 2000);
  };

  // 当前进行中的任务数
  const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length;

  return (
    <TaskContext.Provider
      value={{
        tasks,
        isOpen,
        setIsOpen,
        addTask,
        startPolling,
        fetchTasks,
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
