import type { InsightMindMapNode } from './insightMindMapBuilder';

export type BookEvidence = { id: string; quote: string; locator: Record<string, unknown> };
export type BookTheoryNode = { id: string; parentId: string | null; title: string; summary: string; orderIndex: number; evidence: BookEvidence[] };
export type BookTheoryTreeNode = InsightMindMapNode & { id: string; parentId: string | null; summary: string; evidence: BookEvidence[]; children?: BookTheoryTreeNode[] };

export function buildBookTheoryTree(bookTitle: string, input: BookTheoryNode[]): BookTheoryTreeNode {
  const sorted = [...input].sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
  const byId = new Map(sorted.map((node) => [node.id, { id: node.id, parentId: node.parentId, name: node.title, detail: node.summary, summary: node.summary, evidence: node.evidence, children: [] as BookTheoryTreeNode[] }]));
  const roots: BookTheoryTreeNode[] = [];
  for (const node of sorted) { const treeNode = byId.get(node.id)!; const parent = node.parentId && byId.get(node.parentId); if (parent) parent.children!.push(treeNode); else roots.push(treeNode); }
  return { id: `book:${bookTitle}`, parentId: null, name: bookTitle, detail: '已确认理论框架', summary: '已确认理论框架', evidence: [], children: roots };
}

export function flattenBookTheoryTree(root: BookTheoryTreeNode): BookTheoryTreeNode[] {
  const output: BookTheoryTreeNode[] = [];
  const visit = (node: BookTheoryTreeNode) => { if (!node.id.startsWith('book:')) output.push(node); node.children?.forEach(visit); };
  visit(root); return output;
}
