import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  BookmarkPlus,
  Bot,
  Check,
  Loader2,
  MessageCirclePlus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { callVocabPurify } from '../../../services/difyAPI';
import { useVocabCollect } from '../../../hooks/useVocabCollect';
import type { VocabCategory } from '../../../utils/vocabZoneLabels';
import { normalizeCollectCandidates, parseFocusCommand, type CollectCandidate } from './freeOralModel';
import { showAnchoredConfirm } from '../../overlays/AnchoredOverlayHost';

type FreeOralMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  clientMessageId?: string | null;
  status?: 'pending' | 'completed' | 'failed';
};

type FreeOralSession = {
  id: string;
  title: string;
  focusTopic: string;
  conversationId: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  lastMessage?: string;
  lastMessageAt?: number | null;
  messages?: FreeOralMessage[];
};

type CollectState = 'idle' | 'collecting' | 'collected' | 'queued' | 'failed';

interface FreeOralConversationProps {
  userId: string;
  active?: boolean;
}

const sessionUrl = '/api/english/free-oral/sessions';
const freeOralActiveSessionKey = (userId: string) => `super_agent_free_oral_active_session:${userId}`;
const newId = (): string => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatSessionTime = (timestamp: number) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(timestamp);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `请求失败（HTTP ${response.status}）`);
  return data as T;
}

export default function FreeOralConversation({ userId, active = true }: FreeOralConversationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<FreeOralSession[]>([]);
  const [current, setCurrent] = useState<FreeOralSession | null>(null);
  const [messages, setMessages] = useState<FreeOralMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CollectCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collectSource, setCollectSource] = useState<FreeOralMessage | null>(null);
  const [category, setCategory] = useState<VocabCategory>('business');
  const [collecting, setCollecting] = useState(false);
  const [collectStates, setCollectStates] = useState<Record<string, CollectState>>({});
  const vocab = useVocabCollect({ notify: (message) => setStatus(message) });

  const selectedCount = useMemo(
    () => candidates.reduce((count, item) => count + Number(selected.has(item.id)), 0),
    [candidates, selected],
  );

  const syncSummary = (session: FreeOralSession) => {
    setSessions((items) => [session, ...items.filter((item) => item.id !== session.id)]);
    setCurrent((value) => value?.id === session.id ? { ...value, ...session } : value);
  };

  const createSession = async () => {
    const data = await api<{ session: FreeOralSession }>(sessionUrl, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setSessions((items) => [data.session, ...items]);
    setCurrent(data.session);
    localStorage.setItem(freeOralActiveSessionKey(userId), data.session.id);
    setMessages([]);
    setError('');
    return data.session;
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      await createSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '新建会话失败');
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ session: FreeOralSession }>(`${sessionUrl}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`);
      setCurrent(data.session);
      localStorage.setItem(freeOralActiveSessionKey(userId), id);
      setMessages(data.session.messages || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '会话加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setHistoryLoadFailed(false);
    setError('');
    try {
      const { sessions: saved } = await api<{ sessions: FreeOralSession[] }>(`${sessionUrl}?userId=${encodeURIComponent(userId)}`);
      setSessions(saved);
      if (saved[0]) {
        const rememberedSessionId = localStorage.getItem(freeOralActiveSessionKey(userId));
        const initialSessionId = rememberedSessionId && saved.some((session) => session.id === rememberedSessionId)
          ? rememberedSessionId
          : saved[0].id;
        const detail = await api<{ session: FreeOralSession }>(`${sessionUrl}/${encodeURIComponent(initialSessionId)}?userId=${encodeURIComponent(userId)}`);
        setCurrent(detail.session);
        localStorage.setItem(freeOralActiveSessionKey(userId), detail.session.id);
        setMessages(detail.session.messages || []);
      } else {
        const created = await api<{ session: FreeOralSession }>(sessionUrl, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        });
        setSessions([created.session]);
        setCurrent(created.session);
        localStorage.setItem(freeOralActiveSessionKey(userId), created.session.id);
        setMessages([]);
      }
    } catch (reason) {
      setHistoryLoadFailed(true);
      setError(reason instanceof Error ? reason.message : '历史会话加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active || !userId) return;
    void loadHistory();
  }, [active, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  useGSAP(() => {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const last = rootRef.current?.querySelector('[data-latest-message="true"]');
    if (last) gsap.fromTo(last, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' });
  }, { scope: rootRef, dependencies: [messages.length], revertOnUpdate: true });

  useGSAP(() => {
    if (!collectSource || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo('[data-collect-panel]', { autoAlpha: 0, scale: 0.98 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'power2.out' });
  }, { scope: rootRef, dependencies: [collectSource?.id], revertOnUpdate: true });

  const patchSession = async (session: FreeOralSession, patch: Partial<Pick<FreeOralSession, 'title' | 'focusTopic' | 'conversationId'>>) => {
    const data = await api<{ session: FreeOralSession }>(`${sessionUrl}/${encodeURIComponent(session.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, ...patch }),
    });
    syncSummary(data.session);
    return data.session;
  };

  const saveMessage = async (session: FreeOralSession, message: FreeOralMessage) => {
    const data = await api<{ message: FreeOralMessage }>(`${sessionUrl}/${encodeURIComponent(session.id)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ userId, id: message.id, role: message.role, content: message.content }),
    });
    return data.message;
  };

  const sendMessage = async (text: string, clientMessageId = newId()) => {
    if (!text || sending) return;
    if (!current && !loading && historyLoadFailed) {
      setError('历史会话尚未加载，请先重新加载历史');
      return;
    }
    setError('');
    const command = parseFocusCommand(text);
    if (command.kind === 'invalid') {
      setError(command.error);
      return;
    }

    setSending(true);
    let session = current;
    try {
      if (!session) session = await createSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '会话创建失败');
      setSending(false);
      return;
    }
    setInput('');

    if (command.kind === 'focus') {
      try {
        session = await patchSession(session, {
          focusTopic: command.topic,
          ...(session.title === '新对话' ? { title: command.topic.slice(0, 40) } : {}),
        });
        const message: FreeOralMessage = {
          id: newId(),
          role: 'system',
          content: `当前主题：${command.topic}`,
          createdAt: Date.now(),
        };
        const saved = await saveMessage(session, message);
        setMessages((items) => [...items, saved]);
        setStatus('主题已更新，后续 Dify 对话将围绕该主题展开');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '主题更新失败');
      } finally {
        setSending(false);
      }
      return;
    }

    const userMessage: FreeOralMessage = {
      id: clientMessageId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
      clientMessageId,
      status: 'pending',
    };
    setMessages((items) => [...items, userMessage]);
    setStatus('Dify 正在组织回复…');

    try {
      if (session.title === '新对话') {
        session = await patchSession(session, { title: text.slice(0, 40) });
      }
      const result = await api<{
        userMessage: FreeOralMessage;
        assistantMessage: FreeOralMessage;
        session: FreeOralSession;
        recovered?: boolean;
      }>(`/api/english/oral/free-sessions/${encodeURIComponent(session.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ userId, clientMessageId, content: text }),
      });
      setMessages((items) => [
        ...items.map((item) => item.clientMessageId === clientMessageId || item.id === clientMessageId ? result.userMessage : item),
        ...(items.some((item) => item.id === result.assistantMessage.id) ? [] : [result.assistantMessage]),
      ]);
      syncSummary(result.session);
      setStatus(result.recovered ? '旧会话上下文已根据最近 6 轮恢复' : '回复完成');
    } catch (reason) {
      setMessages((items) => items.map((item) => item.id === clientMessageId ? { ...item, status: 'failed' } : item));
      setError(reason instanceof Error ? reason.message : 'Dify 对话失败');
      setStatus('');
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => void sendMessage(input.trim());
  const handleRetry = (message: FreeOralMessage) => void sendMessage(message.content, message.clientMessageId || message.id);

  const handleExtract = async (message: FreeOralMessage) => {
    setExtractingId(message.id);
    setError('');
    try {
      const result = await callVocabPurify({ article_text: message.content, topic: current?.focusTopic || '' }, userId);
      const next = normalizeCollectCandidates(result);
      if (!next.length) throw new Error('Dify 未提取到适合收录的表达');
      setCandidates(next);
      setSelected(new Set(next.map((item) => item.id)));
      setCollectStates(Object.fromEntries(next.map((item) => [item.id, 'idle'])));
      setCollectSource(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '表达提取失败');
    } finally {
      setExtractingId(null);
    }
  };

  const handleCollect = async () => {
    const targets = candidates.filter((item) => selected.has(item.id) && collectStates[item.id] !== 'collected' && collectStates[item.id] !== 'queued');
    if (!targets.length || collecting) return;
    setCollecting(true);
    setError('');
    let collected = 0;
    let queued = 0;
    let failed = 0;
    const failedIds = new Set<string>();
    try {
      for (const item of targets) {
        setCollectStates((states) => ({ ...states, [item.id]: 'collecting' }));
        try {
        const result = await vocab.collect({
          text: item.text,
          category,
          isPhrase: item.kind === 'phrase',
          isSentence: item.kind === 'sentence',
          topic: current?.focusTopic || '',
          source: 'free_oral_dify',
          payload: {
            meaning: item.meaning,
            phonetic: item.phonetic,
            pos: item.pos,
            source: 'free_oral_dify',
          },
        });
        const nextState: CollectState = result === 'collected' ? 'collected' : result === 'queued' ? 'queued' : 'failed';
        setCollectStates((states) => ({ ...states, [item.id]: nextState }));
          if (nextState === 'collected') collected += 1;
          else if (nextState === 'queued') queued += 1;
          else { failed += 1; failedIds.add(item.id); }
        } catch {
          failed += 1;
          failedIds.add(item.id);
          setCollectStates((states) => ({ ...states, [item.id]: 'failed' }));
        }
      }
      setSelected(failedIds);
      setStatus(`已收录 ${collected} 条，后台处理中 ${queued} 条，失败 ${failed} 条`);
    } finally {
      setCollecting(false);
    }
  };

  const handleDelete = async (session: FreeOralSession, anchor: HTMLElement) => {
    if (!await showAnchoredConfirm({
      anchor,
      message: `删除会话“${session.title}”？此操作不可恢复。`,
      tone: 'danger',
      confirmLabel: '删除会话',
    })) return;
    try {
      await api(`${sessionUrl}/${encodeURIComponent(session.id)}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      const remaining = sessions.filter((item) => item.id !== session.id);
      setSessions(remaining);
      if (current?.id === session.id) {
        if (remaining[0]) await openSession(remaining[0].id);
        else await createSession();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败');
    }
  };

  return (
    <div ref={rootRef} className="relative grid min-h-[620px] grid-cols-1 overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-b border-gray-200 bg-[#f7f8fa] p-3 lg:border-b-0 lg:border-r">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={loading || sending}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        >
          <MessageCirclePlus className="h-4 w-4" /> 新建对话
        </button>
        <div className="flex gap-2 overflow-x-auto lg:block lg:max-h-[535px] lg:space-y-2 lg:overflow-y-auto">
          {sessions.map((session) => (
            <div key={session.id} className={`group flex min-w-52 items-center rounded-xl border p-1 transition lg:min-w-0 ${current?.id === session.id ? 'border-[var(--color-brand)] bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}>
              <button type="button" onClick={() => void openSession(session.id)} disabled={loading || sending} className="min-w-0 flex-1 px-2 py-2 text-left focus-visible:outline-none">
                <span className="block truncate text-sm font-bold text-gray-800">{session.title}</span>
                <span className="mt-1 block truncate text-[11px] text-gray-500">{session.lastMessage || session.focusTopic || '自由话题'}</span>
                <span className="mt-1 block text-[10px] text-gray-400">{session.messageCount || 0} 条消息 · {formatSessionTime(session.lastMessageAt || session.updatedAt)}</span>
              </button>
              <button type="button" aria-label={`删除 ${session.title}`} onClick={(event) => void handleDelete(session, event.currentTarget)} disabled={loading || sending} className="rounded-lg p-2 text-gray-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col bg-[var(--color-canvas)]">
        <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-black text-gray-900"><Sparkles className="h-4 w-4 text-[var(--color-brand)]" />自由即兴对话</h3>
              <p className="mt-0.5 text-xs text-gray-500">Dify 连续上下文 · 输入 <code className="rounded bg-gray-100 px-1">/focus 主题</code> 聚焦后续对话</p>
            </div>
            {current?.focusTopic && <span className="max-w-full truncate rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">当前主题：{current.focusTopic}</span>}
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />加载会话…</div>}
          {!loading && messages.length === 0 && (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white/80 p-8 text-center">
              <Bot className="mx-auto h-9 w-9 text-[var(--color-brand)]" />
              <h4 className="mt-3 font-black text-gray-900">没有固定场景，直接开口</h4>
              <p className="mt-2 text-sm leading-6 text-gray-500">例如：<span className="font-medium text-gray-700">Hello! What makes a city truly sustainable?</span></p>
            </div>
          )}
          {messages.map((message, index) => (
            <article
              key={message.id}
              data-latest-message={index === messages.length - 1 ? 'true' : 'false'}
              className={`free-oral-message flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role !== 'user' && <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === 'system' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--color-brand)] text-white'}`}><Bot className="h-4 w-4" /></div>}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user' ? 'bg-gray-900 text-white' : message.role === 'system' ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-gray-100 bg-white text-gray-800'}`}>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content || (sending ? '…' : '')}</p>
                {message.role === 'user' && message.status === 'failed' && (
                  <button type="button" onClick={() => handleRetry(message)} disabled={sending} className="mt-2 rounded-lg border border-white/40 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50">
                    重新发送
                  </button>
                )}
                {message.role === 'assistant' && message.content && (
                  <button type="button" onClick={() => void handleExtract(message)} disabled={extractingId === message.id} className="mt-3 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-50">
                    {extractingId === message.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                    一键收入
                  </button>
                )}
              </div>
              {message.role === 'user' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white"><User className="h-4 w-4" /></div>}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-gray-200 bg-white p-3 sm:p-4">
          {(error || status) && (
            <div className="mb-2 flex items-center gap-2 text-xs font-medium">
              <p role={error ? 'alert' : 'status'} className={error ? 'text-red-600' : 'text-gray-500'}>{error || status}</p>
              {historyLoadFailed && <button type="button" onClick={() => void loadHistory()} disabled={loading} className="rounded-lg border border-red-200 px-2 py-1 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">重新加载历史</button>}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm focus-within:border-[var(--color-brand)]">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              aria-label="自由口语消息"
              placeholder="输入英文开始自由对话，或 /focus 主题…"
              rows={2}
              maxLength={4000}
              disabled={loading || sending}
              className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-60"
            />
            <button type="button" aria-label="发送消息" onClick={() => void handleSend()} disabled={!input.trim() || loading || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      </section>

      {collectSource && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="选择收入生词本的表达">
          <div data-collect-panel className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-black text-gray-900">Dify 已提取 {candidates.length} 条优秀表达</h4>
                <p className="mt-1 text-xs text-gray-500">勾选后调用现有字典收录逻辑补齐释义并加入生词本。</p>
              </div>
              <button type="button" aria-label="关闭表达候选" onClick={() => setCollectSource(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 flex rounded-xl bg-gray-100 p-1">
              {(['business', 'general'] as VocabCategory[]).map((zone) => (
                <button key={zone} type="button" onClick={() => setCategory(zone)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${category === zone ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  {zone === 'business' ? '政商务区' : '全场景区'}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
              {candidates.map((item) => {
                const checked = selected.has(item.id);
                const itemState = collectStates[item.id] || 'idle';
                const stateLabel = { idle: '', collecting: '收录中', collected: '已收录', queued: '后台处理中', failed: '收录失败' }[itemState];
                return (
                  <button key={item.id} type="button" disabled={collecting || itemState === 'collected' || itemState === 'queued'} onClick={() => setSelected((items) => {
                    const next = new Set(items);
                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                    return next;
                  })} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-[var(--color-brand)] bg-orange-50/60' : 'border-gray-200 bg-white'}`}>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-gray-300'}`}>{checked && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-gray-900">{item.text}</span>
                      {item.meaning && <span className="mt-1 block text-xs text-gray-500">{item.meaning}</span>}
                    </span>
                    <span className="text-right">
                      <span className="block rounded bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">{item.kind}</span>
                      {stateLabel && <span className={`mt-1 block text-[10px] font-bold ${itemState === 'failed' ? 'text-red-600' : itemState === 'queued' ? 'text-amber-600' : 'text-green-600'}`}>{stateLabel}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <span className="text-xs font-medium text-gray-500">已选 {selectedCount} 条</span>
              <button type="button" onClick={() => void handleCollect()} disabled={!selectedCount || collecting} className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">
                {collecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {Array.from(selected).some((id) => collectStates[id] === 'failed') ? '重试失败项' : '收入生词本'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
