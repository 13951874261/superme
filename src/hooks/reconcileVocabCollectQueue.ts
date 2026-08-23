export type VocabCollectTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface VocabCollectQueueTask {
  id: string;
  status: VocabCollectTaskStatus;
  type?: string;
  name?: string;
}

const VOCAB_ADD_NAME = /^生词本收录:\s*(.+)$/;

/** 任务中心已完成的单条收录，用任务名把词收回「已收录」。 */
export function collectedKeysFromVocabAddTasks(tasks: VocabCollectQueueTask[]): string[] {
  const keys: string[] = [];
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    if (task.type && task.type !== 'vocab_add') continue;
    const match = VOCAB_ADD_NAME.exec(task.name || '');
    if (!match) continue;
    keys.push(match[1].replace(/…$/, '').trim().toLowerCase());
  }
  return keys;
}

/** 任务中心状态回来后，把 queued 词收成 collected / 可重试。 */
export function reconcileVocabCollectQueue(
  taskIdToKey: Record<string, string>,
  tasks: VocabCollectQueueTask[],
): {
  collectedKeys: string[];
  failedKeys: string[];
  remaining: Record<string, string>;
} {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const collectedKeys: string[] = [];
  const failedKeys: string[] = [];
  const remaining: Record<string, string> = {};

  for (const [taskId, key] of Object.entries(taskIdToKey)) {
    const status = byId.get(taskId)?.status;
    if (status === 'completed') {
      collectedKeys.push(key);
    } else if (status === 'failed') {
      failedKeys.push(key);
    } else {
      remaining[taskId] = key;
    }
  }

  return { collectedKeys, failedKeys, remaining };
}
