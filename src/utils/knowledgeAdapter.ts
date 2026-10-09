import {
  isUsableForModule,
  type KnowledgeItem,
  type KnowledgeModule,
} from '../types/knowledge';

export const MAX_KNOWLEDGE_ITEMS = 5;
export const MAX_CONTEXT_CHARS = 6000;

const TRUNCATED_SUFFIX = '\n[内容已截断]';

function recency(item: KnowledgeItem): number {
  return item.confirmedAt ?? item.updatedAt;
}

/** 按最近 confirmedAt / updatedAt 排序，最多取 5 条。不发网络请求。 */
export function selectKnowledgeForInject(items: KnowledgeItem[]): KnowledgeItem[] {
  return [...items]
    .sort((a, b) => recency(b) - recency(a))
    .slice(0, MAX_KNOWLEDGE_ITEMS);
}

function formatKnowledgeBlock(item: KnowledgeItem, index: number): string {
  const lines = [`${index + 1}. ${item.title}`];
  if (item.summary && item.summary !== item.content) {
    lines.push(item.summary);
  }
  if (item.content) {
    lines.push(item.content);
  }
  return lines.join('\n');
}

function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  const budget = Math.max(0, MAX_CONTEXT_CHARS - TRUNCATED_SUFFIX.length);
  return text.slice(0, budget) + TRUNCATED_SUFFIX;
}

function buildKnowledgeContext(items: KnowledgeItem[], module: KnowledgeModule, heading: string): string {
  const usable = items.filter((item) => isUsableForModule(item, module));
  const selected = selectKnowledgeForInject(usable);
  if (selected.length === 0) return '';

  const body = selected.map((item, index) => formatKnowledgeBlock(item, index)).join('\n\n');
  return truncateContext(`${heading}\n${body}`);
}

export function buildListenKnowledgeContext(items: KnowledgeItem[]): string {
  return buildKnowledgeContext(items, 'listen', '【听力知识】');
}

export function buildSpeakKnowledgeContext(items: KnowledgeItem[]): string {
  return buildKnowledgeContext(items, 'speak', '【口语知识】');
}

export function buildGameTheoryKnowledgeContext(items: KnowledgeItem[]): string {
  return buildKnowledgeContext(items, 'game_theory', '【博弈知识】');
}

export function buildGameTheoryKnowledgeHint(linkedCount: number, tacticsCount: number): string {
  const linked = Math.max(0, Number(linkedCount) || 0);
  if (linked > 0) {
    return `已同步 ${linked} 条博弈知识，本次训练将自动引用 ${Math.min(linked, MAX_KNOWLEDGE_ITEMS)} 条`;
  }
  const tactics = Math.max(0, Number(tacticsCount) || 0);
  if (tactics > 0) {
    return `已引用战术库 ${Math.min(tactics, MAX_KNOWLEDGE_ITEMS)} 条`;
  }
  return '尚未同步博弈知识，本次训练不注入资料抽屉内容';
}

export function buildWritingKnowledgeContext(items: KnowledgeItem[]): string {
  return buildKnowledgeContext(items, 'writing', '【写作知识】');
}

export function buildAestheticKnowledgeContext(items: KnowledgeItem[]): string {
  return buildKnowledgeContext(items, 'aesthetic', '【审美知识】');
}
