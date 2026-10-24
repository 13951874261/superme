import type { SpeakingScene } from '../../../../services/speakingScenesAPI';

const FALLBACK_PREFIX = 'fallback-impromptu-';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildFallbackImpromptuScene(userId: string, topic: string, sceneDate = new Date().toISOString().slice(0, 10)): SpeakingScene {
  const normalizedTopic = topic.trim() || 'Professional communication challenge';
  return {
    id: `${FALLBACK_PREFIX}${stableHash(`${userId}:${normalizedTopic}`)}`,
    userId,
    sceneDate,
    sceneType: 'impromptu',
    content: {
      topic: normalizedTopic,
      background: `你需要在临时会议中围绕“${normalizedTopic}”进行一段有逻辑、有立场的英文发言。`,
      identity: '负责推动议题落地的业务负责人',
      audience: '需要快速理解情况并作出判断的管理者与协作方',
      objective: '清晰说明背景、提出主张，并推动听众接受下一步行动',
      conflict: '准备时间有限，同时需要平衡不同立场、风险与业务结果',
      structure: ['用一句话给出核心立场', '说明背景与关键矛盾', '给出两到三个理由或证据', '总结并提出明确行动'],
      points: ['先结论后论据', '主动回应最可能的反对意见', '将建议连接到可衡量的结果'],
      keywords: ['position', 'trade-off', 'evidence', 'impact', 'next step'],
      opening: `Today I would like to address ${normalizedTopic} by clarifying the core issue, the trade-offs, and the action I recommend.`,
    },
    contentHash: `fallback-${stableHash(normalizedTopic)}`,
    profileHash: 'fallback',
    useCount: 0,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function isFallbackImpromptuScene(scene: SpeakingScene | null): boolean {
  return Boolean(scene?.id.startsWith(FALLBACK_PREFIX));
}

export function selectInitialImpromptuScene(scenes: SpeakingScene[]): SpeakingScene | null {
  return scenes.find((scene) => scene.sceneType === 'impromptu') || null;
}

export function buildImpromptuThemeContext(scene: SpeakingScene | null, fallback = ''): string {
  if (!scene || scene.sceneType !== 'impromptu') return fallback;
  const { topic, background, identity, audience, objective, conflict } = scene.content;
  return `${topic}\n背景：${background}\n身份：${identity}\n听众：${audience}\n目标：${objective}\n冲突：${conflict}`;
}

export function canApplySpeechGeneration(token: number, currentToken: number, sceneId: string, currentSceneId: string): boolean {
  return token === currentToken && sceneId === currentSceneId;
}
