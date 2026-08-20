const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class InMemoryTaskQueue {
  constructor() {
    this.tasks = new Map();
    this.TTL = 3600 * 1000; // 默认 1 小时过期
    this.queuePath = path.join(__dirname, '..', 'data', 'tasks.json');

    // 确保 data 目录存在
    const dataDir = path.dirname(this.queuePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 从磁盘恢复任务队列
    this._load();

    // 定时清理过期任务 (每 10 分钟)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }
  }

  /**
   * 从磁盘加载任务队列
   */
  _load() {
    try {
      if (fs.existsSync(this.queuePath)) {
        const data = JSON.parse(fs.readFileSync(this.queuePath, 'utf-8'));
        for (const task of data.tasks) {
          // 只恢复非终态任务（pending/running）
          if (task.status === 'pending' || task.status === 'running') {
            // 将其标记为 failed（服务器重启意味着之前的异步任务已中断）
            task.status = 'failed';
            task.error = '服务器重启，任务已中断';
            task.completedAt = Date.now();
          }
          this.tasks.set(task.id, task);
        }
        console.log(`[TaskQueue] 从磁盘恢复 ${this.tasks.size} 个任务`);
      }
    } catch (e) {
      console.error('[TaskQueue] 恢复任务队列失败:', e.message);
    }
  }

  /**
   * 持久化任务队列到磁盘
   */
  _save() {
    try {
      const data = {
        version: 1,
        savedAt: Date.now(),
        tasks: Array.from(this.tasks.values())
      };
      fs.writeFileSync(this.queuePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[TaskQueue] 保存任务队列失败:', e.message);
    }
  }

  /**
   * 创建一个后台任务
   * @param {string} type 任务类型，如 'tts'
   * @param {string} name 任务名称
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
      updatedAt: Date.now(),
      result: null,
      error: null
    };
    this.tasks.set(id, task);
    this._save(); // 立即持久化
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

    // 终态任务标记完成时间
    if (task.status === 'completed' || task.status === 'failed') {
      task.completedAt = Date.now();
    }

    this._save(); // 状态变更时持久化
  }

  /**
   * 清理过期任务（保留终态任务一段时间便于查询）
   */
  cleanup() {
    const now = Date.now();
    let changed = false;
    const toDelete = [];

    for (const [id, task] of this.tasks.entries()) {
      // 终态任务保留 30 分钟（便于前端轮询查到失败原因）
      if (task.status === 'completed' || task.status === 'failed') {
        if (now - (task.completedAt || task.updatedAt) > 30 * 60 * 1000) {
          toDelete.push(id);
        }
      }
      // 待处理/运行中任务超过 2 小时强制终止
      else if (now - task.createdAt > 2 * 60 * 60 * 1000) {
        task.status = 'failed';
        task.error = '任务超时未完成';
        task.completedAt = now;
        changed = true;
      }
    }

    // 批量删除
    for (const id of toDelete) {
      this.tasks.delete(id);
    }

    if (toDelete.length > 0 || changed) {
      this._save();
      console.log(`[TaskQueue] 清理了 ${toDelete.length} 个过期任务，更新了 ${changed ? 1 : 0} 个超时任务`);
    }
  }

  /**
   * 获取所有任务列表（按创建时间逆序）
   */
  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}

// 单例导出
const taskQueue = new InMemoryTaskQueue();
module.exports = taskQueue;
