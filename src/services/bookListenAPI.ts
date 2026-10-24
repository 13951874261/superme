import type { BookEvidence, BookTheoryNode } from '../utils/bookTheoryTree';

export type BookSummary = { id: string; title: string; active_framework_revision_id?: string | null };
export type ListenContent = { id: string; frameworkRevisionId: string; frameworkNodeId: string; title: string; script: string; definition?: string; plainExplanation?: string; sourceEvidence: BookEvidence[]; selfCheckQuestions: string[]; claims: Array<{ text: string; kind: 'source_claim' | 'system_synthesis'; confidence: 'low' | 'medium' | 'high'; evidenceIds: string[] }>; stale: boolean; audio?: ListenAudio | null };
export type ListenAudio = { id: string; streamUrl: string; stale: boolean; status: string };
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
};
export const listBooks = async () => (await request<{ books: BookSummary[] }>('/api/books')).books;
export const getListenFramework = async (bookId: string, revisionId?: string) => {
  const query = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
  const body = await request<{ book: BookSummary; revision: { id: string; revision_number: number }; nodes: Array<{ id: string; parent_id: string | null; title: string; summary: string; order_index: number; evidence: Array<BookEvidence & { locator: Record<string, unknown> }> }> }>(`/api/books/${encodeURIComponent(bookId)}/listen-framework${query}`);
  return { ...body, nodes: body.nodes.map((node): BookTheoryNode => ({ id: node.id, parentId: node.parent_id, title: node.title, summary: node.summary, orderIndex: node.order_index, evidence: node.evidence })) };
};
export const getListenContent = async (bookId: string, revisionId: string, nodeId: string) => (await request<{ content: ListenContent }>(`/api/books/${bookId}/frameworks/${revisionId}/nodes/${nodeId}/listen-content`)).content;
export const generateListenContent = async (bookId: string, revisionId: string, nodeId: string) => (await request<{ content: ListenContent }>(`/api/books/${bookId}/frameworks/${revisionId}/nodes/${nodeId}/listen-content`, { method: 'POST', body: '{}' })).content;
export const generateListenAudio = async (bookId: string, revisionId: string, nodeId: string, contentId: string) => (await request<{ audio: ListenAudio }>(`/api/books/${bookId}/frameworks/${revisionId}/nodes/${nodeId}/listen-content/${contentId}/listen-audio`, { method: 'POST', body: '{}' })).audio;
export const getFrameworkEvidence = async (bookId: string, revisionId: string) => (await request<{ evidence: Array<BookEvidence & { source_unit_id: string }> }>(`/api/books/${bookId}/frameworks/${revisionId}/evidence`)).evidence;
