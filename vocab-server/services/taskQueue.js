const crypto = require('crypto');

class InMemoryTaskQueue {
  constructor() {
    this.tasks = new Map();
    this.TTL = 3600 * 1000; // 默认 1 小时过期
    
    // 定时清理过期任务 (每 10 分钟)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }
  }

  /**
   * 创建一个后台任务
   * @param {string} type 任务类型，如 'video'
   * @param {string} name 任务名称，如文件名或链接
   * @returns {object}
   */
  createTask(type, name) {
    const id = `task_${type}_${crypto.randomBytes(8).toString('hex')}`;
    const task = {
      id,
      type,
      name,
      status: 'pending', // 'pending' | 'running' | 'completed' | 'failed'
      progress: 0,
      logs: [`[${new Date().toISOString()}] 任务已创建，等待调度...`],
      createdAt: Date.now(),
      result: null,
      error: null
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * 获取任务详情
   * @param {string} id 
   * @returns {object|undefined}
   */
  getTask(id) {
    return this.tasks.get(id);
  }

  /**
   * 更新任务状态和日志
   * @param {string} id 
   * @param {object} patch 
   */
  updateTask(id, patch) {
    const task = this.tasks.get(id);
    if (!task) return;

    if (patch.logs && Array.isArray(patch.logs)) {
      const timestampedLogs = patch.logs.map(log => `[${new Date().toISOString()}] ${log}`);
      task.logs = [...task.logs, ...timestampedLogs];
      delete patch.logs;
    }

    Object.assign(task, patch);
    task.updatedAt = Date.now();
  }

  /**
   * 清理过期任务
   */
  cleanup() {
    const now = Date.now();
    for (const [id, task] of this.tasks.entries()) {
      if (now - task.createdAt > this.TTL) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * 获取所有任务列表 (按创建时间逆序)
   */
  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}

// 单例导出
const taskQueue = new InMemoryTaskQueue();
module.exports = taskQueue;
