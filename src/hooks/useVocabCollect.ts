import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addWordEnriched,
  addVocabWithTimeout,
  batchAddWordsAsync,
  buildVocabCollectPayload,
  lookupVocabWords,
  type VocabEntry,
} from '../services/vocabAPI';
import { useTask } from '../components/TaskContext';
import { playSuccess, playError } from '../utils/soundEffects';
import { notifyBackgroundHandoff } from '../utils/backgroundHandoff';
import { collectedKeysFromVocabAddTasks, reconcileVocabCollectQueue } from './reconcileVocabCollectQueue';
import type { VocabCategory } from '../utils/vocabZoneLabels';
import { VOCAB_ZONE_LABEL, stripThinHoverSeed } from '../utils/vocabZoneLabels';

/** 收录竞速阈值：3 秒内未完成即转入后台【任务中心】异步处理，防止前端卡死 */
export const VOCAB_COLLECT_RACE_MS = 3000;

export interface VocabCollectRequest {
  text: string;
  category: VocabCategory;
  isPhrase?: boolean;
  isSentence?: boolean;
  dictType?: string;
  topic?: string;
  source?: string;
  /** 已知的音标/释义等提示信息，服务端补齐矩阵时作为起点 */
  payload?: Record<string, any>;
  /** 触发按钮 DOM，用于就近 handoff 提示 */
  anchor?: HTMLElement | null;
  /** 仅迁移分区，跳过词典拉取（矩阵已齐备） */
  migrateOnly?: boolean;
  /** 调用方已备好词典 payload（如词典面板），不再重复 dict-query */
  skipDictFetch?: boolean;
}

export type VocabCollectResult = 'collected' | 'queued' | 'failed' | 'blocked';

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
  const [collectingZone, setCollectingZone] = useState<Record<string, VocabCategory | undefined>>({});
  const [queuedZone, setQueuedZone] = useState<Record<string, VocabCategory | undefined>>({});
  const [storedCategory, setStoredCategory] = useState<Record<string, VocabCategory>>({});
  const queuedTaskIdsRef = useRef<Record<string, string>>({});
  const collectingRef = useRef<Record<string, VocabCategory | undefined>>({});
  const queuedRef = useRef<Record<string, VocabCategory | undefined>>({});

  useEffect(() => {
    const { collectedKeys, failedKeys, remaining } = reconcileVocabCollectQueue(
      queuedTaskIdsRef.current,
      tasks,
    );
    const namedKeys = collectedKeysFromVocabAddTasks(tasks);
    const doneKeys = Array.from(new Set([...collectedKeys, ...namedKeys]));
    if (doneKeys.length === 0 && failedKeys.length === 0) return;

    queuedTaskIdsRef.current = remaining;
    for (const key of [...doneKeys, ...failedKeys]) {
      delete queuedRef.current[key];
    }
    setQueuedZone((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of [...doneKeys, ...failedKeys]) {
        if (key in next) { delete next[key]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const hydrateFromEntries = useCallback((entries: VocabEntry[]) => {
    if (!entries.length) return;
    setStoredCategory((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of entries) {
        const key = normalizeKey(item.word);
        if (!key) continue;
        if (next[key] !== item.category) {
          next[key] = item.category;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const hydrateTexts = useCallback((texts: string[]) => {
    const clean = texts.map((item) => String(item || '').trim()).filter(Boolean);
    if (!clean.length) return;
    void lookupVocabWords(clean).then((items) => {
      if (items.length) hydrateFromEntries(items);
    }).catch(() => {});
  }, [hydrateFromEntries]);

  const collect = useCallback(async (request: VocabCollectRequest): Promise<VocabCollectResult> => {
    const text = (request.text || '').trim();
    if (!text) return 'failed';

    const key = normalizeKey(text);
    const label = text.length > 20 ? `${text.slice(0, 20)}…` : text;
    const isPhrase = !!request.isPhrase;
    const isSentence = !!request.isSentence;
    const category = request.category;
    const dictType = request.dictType
      || (isSentence ? 'ai_sentence' : (isPhrase ? 'ai_phrase' : 'ai_extracted'));
    const anchor = request.anchor ?? null;

    const activeZone = collectingRef.current[key] || queuedRef.current[key];
    if (activeZone) {
      if (activeZone !== category) {
        notify?.(`正在收录至${VOCAB_ZONE_LABEL[activeZone]}，请稍候`, 'info');
      }
      return 'blocked';
    }

    collectingRef.current[key] = category;
    setCollectingZone((prev) => ({ ...prev, [key]: category }));
    setQueuedZone((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (anchor) {
      showNearCollectingTip(anchor, label);
    }

    // 单词走 Cambridge 优先（英汉双向），短语/句型走纯 Dify；
    // 迁移分区只改 category，不重取词典也不回写 payload，避免覆盖已补齐的矩阵。
    // 词典拉取纳入 3 秒竞速：超时仍转任务中心，不让用户先干等 dict-query；
    // handoff 时复用同一 in-flight dict 请求，避免慢网丢 Cambridge 种子。
    let collectPayload = request.migrateOnly ? undefined : request.payload;
    let resolvedPrev = storedCategory[key] as VocabCategory | undefined;
    const dictFetchPromise = !request.migrateOnly && !request.skipDictFetch
      ? buildVocabCollectPayload(text, {
          isPhrase,
          isSentence,
          source: request.source,
        }).catch(() => null)
      : null;
    const toBatchItem = () => ({
      word: text,
      category,
      scene_type: category,
      is_phrase: isPhrase,
      is_sentence: isSentence,
      dictType,
      payload: collectPayload,
    });
    const resolveHandoffPayload = async () => {
      if (hasDictBody(collectPayload)) return collectPayload;
      if (dictFetchPromise) {
        try {
          const dictPayload = await dictFetchPromise;
          if (dictPayload && Object.keys(dictPayload).length > 0) {
            return { ...(request.payload || {}), ...dictPayload };
          }
        } catch {
          // 词典失败不阻断 handoff
        }
      }
      return stripThinHoverSeed(collectPayload);
    };

    try {
      const action = (async () => {
        if (!resolvedPrev) {
          try {
            const items = await lookupVocabWords([text]);
            if (items[0]?.category) {
              resolvedPrev = items[0].category;
              hydrateFromEntries(items);
            }
          } catch {
            // 查已收录失败不阻断；按新收录继续
          }
        }
        if (resolvedPrev && resolvedPrev === category) {
          return { matrixReady: true };
        }
        const migrateOnly = request.migrateOnly || (!!resolvedPrev && resolvedPrev !== category);
        collectPayload = migrateOnly ? undefined : request.payload;
        if (!migrateOnly && dictFetchPromise) {
          try {
            const dictPayload = await dictFetchPromise;
            if (dictPayload && Object.keys(dictPayload).length > 0) {
              collectPayload = { ...(request.payload || {}), ...dictPayload };
            } else {
              collectPayload = stripThinHoverSeed(collectPayload);
            }
          } catch {
            // 词典失败不阻断收录，但不把悬浮薄缓存当最终 Cam/Dify 结果
            collectPayload = stripThinHoverSeed(collectPayload);
          }
        }
        return addWordEnriched({
          word: text,
          dictType,
          category,
          scene_type: category,
          is_phrase: isPhrase,
          is_sentence: isSentence,
          topic: request.topic,
          source: request.source,
          payload: collectPayload,
        });
      })();
      action.catch(() => {});

      const race = await addVocabWithTimeout(action, VOCAB_COLLECT_RACE_MS);

      if (race.isTimeout) {
        collectPayload = await resolveHandoffPayload();
        const queuedRes = await batchAddWordsAsync(
          [toBatchItem()],
          request.topic || '逐条收录',
          request.source || 'Manual Select',
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
        queuedRef.current[key] = category;
        setQueuedZone((prev) => ({ ...prev, [key]: category }));
        const msg = `“${label}” 已加入生词本，详细信息正在后台补齐，可在【任务中心】查看`;
        notifyBackgroundHandoff({ anchor, message: msg, tone: 'info' });
        if (!anchor) notify?.(msg, 'info');
        return 'queued';
      }

      if (!('result' in race)) {
        return 'failed';
      }

      const result = race.result as { matrixReady?: boolean };
      setStoredCategory((prev) => ({ ...prev, [key]: category }));
      setQueuedZone((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      playSuccess();
      window.dispatchEvent(new Event('vocab-updated'));

      const prevCat = resolvedPrev || storedCategory[key];
      const isMigrate = request.migrateOnly || (prevCat && prevCat !== category);

      if (result?.matrixReady === false) {
        const msg = `“${label}” 已加入生词本；详细信息稍后续补，可在【任务中心】查看进度`;
        notifyBackgroundHandoff({ anchor, message: msg, tone: 'info', pulse: true });
        if (!anchor) notify?.(msg, 'info');
      } else if (isMigrate) {
        const msg = `“${label}” 已移至${VOCAB_ZONE_LABEL[category]}`;
        if (anchor) {
          notifyBackgroundHandoff({ anchor, message: msg, tone: 'success', pulse: false });
        } else {
          notify?.(msg, 'success');
        }
      } else {
        const msg = `“${label}” 已收录至${VOCAB_ZONE_LABEL[category]}，释义等信息已补齐`;
        if (anchor) {
          notifyBackgroundHandoff({ anchor, message: msg, tone: 'success', pulse: false });
        } else {
          notify?.(msg, 'success');
        }
      }
      return 'collected';
    } catch (error: any) {
      try {
        collectPayload = await resolveHandoffPayload();
        const queuedRes = await batchAddWordsAsync(
          [toBatchItem()],
          request.topic || '逐条收录',
          request.source || 'Manual Select',
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
        queuedRef.current[key] = category;
        setQueuedZone((prev) => ({ ...prev, [key]: category }));
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
      if (collectingRef.current[key] === category) {
        delete collectingRef.current[key];
      }
      setCollectingZone((prev) => {
        if (prev[key] !== category) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [addTask, startPolling, notify, storedCategory, hydrateFromEntries]);

  /** @deprecated 使用 hydrateFromEntries 以保留分区信息 */
  const hydrateCollected = useCallback((texts: string[]) => {
    void texts;
  }, []);

  return {
    collect,
    hydrateCollected,
    hydrateFromEntries,
    hydrateTexts,
    getCollectingZone: (text: string) => collectingZone[normalizeKey(text)] ?? null,
    getQueuedZone: (text: string) => queuedZone[normalizeKey(text)] ?? null,
    getStoredCategory: (text: string) => storedCategory[normalizeKey(text)] ?? null,
    isCollecting: (text: string) => !!collectingZone[normalizeKey(text)],
    isQueued: (text: string) => !!queuedZone[normalizeKey(text)],
    isCollected: (text: string) => !!storedCategory[normalizeKey(text)],
  };
}

function hasDictBody(payload?: Record<string, any>) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.cambridge_raw && typeof payload.cambridge_raw === 'object') return true;
  if (typeof payload.definition_en === 'string' && payload.definition_en.trim()) return true;
  if (Array.isArray(payload.synonyms) && payload.synonyms.length > 0) return true;
  return false;
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
