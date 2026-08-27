import { useCallback, useEffect, useRef, useState } from 'react';
import { addWordEnriched, addVocabWithTimeout, batchAddWordsAsync } from '../services/vocabAPI';
import { useTask } from '../components/TaskContext';
import { playSuccess, playError } from '../utils/soundEffects';
import { notifyBackgroundHandoff } from '../utils/backgroundHandoff';
import { collectedKeysFromVocabAddTasks, reconcileVocabCollectQueue } from './reconcileVocabCollectQueue';

/** 收录竞速阈值：3 秒内未完成即转入后台【任务中心】异步处理，防止前端卡死 */
export const VOCAB_COLLECT_RACE_MS = 3000;

export interface VocabCollectRequest {
  text: string;
  isPhrase?: boolean;
  isSentence?: boolean;
  dictType?: string;
  topic?: string;
  source?: string;
  /** 已知的音标/释义等提示信息，服务端补齐矩阵时作为起点 */
  payload?: Record<string, any>;
  /** 触发按钮 DOM，用于就近 handoff 提示 */
  anchor?: HTMLElement | null;
}

export type VocabCollectResult = 'collected' | 'queued' | 'failed';

export interface UseVocabCollectOptions {
  notify?: (message: string, type: 'success' | 'info' | 'error') => void;
}

const normalizeKey = (text: string) => text.trim().toLowerCase();

/**
 * 逐条收录词/短语/句式的统一入口。
 * 收录即由服务端补齐词汇矩阵；3 秒未完成则转入任务中心继续补齐。
 */
export function useVocabCollect(options: UseVocabCollectOptions = {}) {
  const { addTask, startPolling, tasks } = useTask();
  const { notify } = options;
  const [collecting, setCollecting] = useState<Record<string, boolean>>({});
  const [queued, setQueued] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState<Record<string, boolean>>({});
  const queuedTaskIdsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const { collectedKeys, failedKeys, remaining } = reconcileVocabCollectQueue(
      queuedTaskIdsRef.current,
      tasks,
    );
    const namedKeys = collectedKeysFromVocabAddTasks(tasks);
    const doneKeys = Array.from(new Set([...collectedKeys, ...namedKeys]));
    if (doneKeys.length === 0 && failedKeys.length === 0) return;

    queuedTaskIdsRef.current = remaining;
    setQueued((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of doneKeys) {
        if (key in next) { delete next[key]; changed = true; }
      }
      for (const key of failedKeys) {
        if (key in next) { delete next[key]; changed = true; }
      }
      return changed ? next : prev;
    });
    if (doneKeys.length > 0) {
      setCollected((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const key of doneKeys) {
          if (!next[key]) { next[key] = true; changed = true; }
        }
        return changed ? next : prev;
      });
    }
  }, [tasks]);

  const collect = useCallback(async (request: VocabCollectRequest): Promise<VocabCollectResult> => {
    const text = (request.text || '').trim();
    if (!text) return 'failed';

    const key = normalizeKey(text);
    const label = text.length > 20 ? `${text.slice(0, 20)}…` : text;
    const isPhrase = !!request.isPhrase;
    const isSentence = !!request.isSentence;
    const dictType = request.dictType
      || (isSentence ? 'ai_sentence' : (isPhrase ? 'ai_phrase' : 'ai_extracted'));
    const anchor = request.anchor ?? null;

    setCollecting((prev) => ({ ...prev, [key]: true }));
    setQueued((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (anchor) {
      showNearCollectingTip(anchor, label);
    }

    try {
      const action = addWordEnriched({
        word: text,
        dictType,
        category: 'business',
        is_phrase: isPhrase,
        is_sentence: isSentence,
        topic: request.topic,
        source: request.source,
        payload: request.payload,
      });
      // 竞速超时后由后台任务接管，这里兜掉迟到的拒绝，避免未捕获异常
      action.catch(() => {});

      const race = await addVocabWithTimeout(action, VOCAB_COLLECT_RACE_MS);

      if (race.isTimeout) {
        const queuedRes = await batchAddWordsAsync(
          [{ word: text, is_phrase: isPhrase, is_sentence: isSentence, dictType, payload: request.payload }],
          request.topic || '逐条收录',
          request.source || 'Manual Select'
        );
        addTask({
          id: queuedRes.taskId,
          type: 'vocab_add',
          name: `生词本收录: ${label}`,
          status: 'running',
          progress: 20,
          logs: ['[生词收录] 稍久未完成，已转入任务中心继续写入并补齐释义等信息…'],
        });
        startPolling?.(queuedRes.taskId);
        queuedTaskIdsRef.current[queuedRes.taskId] = key;
        setQueued((prev) => ({ ...prev, [key]: true }));
        const msg = `“${label}” 已加入生词本，详细信息正在后台补齐，可在【任务中心】查看`;
        notifyBackgroundHandoff({ anchor, message: msg, tone: 'info' });
        // 有锚点时就近浮层已提示，避免 notify→Toast/showNotice 再弹同文案
        if (!anchor) notify?.(msg, 'info');
        return 'queued';
      }

      if (!('result' in race)) {
        // 超时已在上面处理完，兜底
        return;
      }

      const result = race.result as { matrixReady?: boolean };
      setCollected((prev) => ({ ...prev, [key]: true }));
      setQueued((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      playSuccess();
      window.dispatchEvent(new Event('vocab-updated'));
      if (result?.matrixReady === false) {
        const msg = `“${label}” 已加入生词本；详细信息稍后续补，可在【任务中心】查看进度`;
        notifyBackgroundHandoff({ anchor, message: msg, tone: 'info', pulse: true });
        if (!anchor) notify?.(msg, 'info');
      } else {
        const msg = `“${label}” 已加入生词本，释义等信息已补齐`;
        if (anchor) {
          notifyBackgroundHandoff({ anchor, message: msg, tone: 'success', pulse: false });
        } else {
          notify?.(msg, 'success');
        }
      }
      return 'collected';
    } catch (error: any) {
      // 同步路径真失败时仍尝试托管后台，避免用户只能看到红条
      try {
        const queuedRes = await batchAddWordsAsync(
          [{ word: text, is_phrase: isPhrase, is_sentence: isSentence, dictType, payload: request.payload }],
          request.topic || '逐条收录',
          request.source || 'Manual Select'
        );
        addTask({
          id: queuedRes.taskId,
          type: 'vocab_add',
          name: `生词本收录: ${label}`,
          status: 'running',
          progress: 20,
          logs: ['[生词收录] 未能立刻完成，已改由任务中心继续补齐释义等信息…'],
        });
        startPolling?.(queuedRes.taskId);
        queuedTaskIdsRef.current[queuedRes.taskId] = key;
        setQueued((prev) => ({ ...prev, [key]: true }));
        const msg = `“${label}” 已加入生词本，详细信息正在后台补齐，可在【任务中心】查看`;
        notifyBackgroundHandoff({ anchor, message: msg, tone: 'info' });
        if (!anchor) notify?.(msg, 'info');
        return 'queued';
      } catch {
        playError();
        notify?.(`收录失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        return 'failed';
      }
    } finally {
      setCollecting((prev) => ({ ...prev, [key]: false }));
    }
  }, [addTask, startPolling, notify]);

  const hydrateCollected = useCallback((texts: string[]) => {
    const keys = texts.map(normalizeKey).filter(Boolean);
    if (keys.length === 0) return;
    setQueued((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (key in next) { delete next[key]; changed = true; }
      }
      return changed ? next : prev;
    });
    setCollected((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (!next[key]) { next[key] = true; changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  return {
    collect,
    hydrateCollected,
    isCollecting: (text: string) => !!collecting[normalizeKey(text)],
    isQueued: (text: string) => !!queued[normalizeKey(text)],
    isCollected: (text: string) => !!collected[normalizeKey(text)],
  };
}

function showNearCollectingTip(anchor: HTMLElement, label: string) {
  notifyBackgroundHandoff({
    anchor,
    message: `“${label}” 收录中，较慢时会转入后台补齐释义等信息`,
    tone: 'info',
    toast: false,
    pulse: false,
    nearDuration: 2200,
  });
}
