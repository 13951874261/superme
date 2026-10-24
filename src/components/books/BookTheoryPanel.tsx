import { useCallback, useEffect, useMemo, useState } from 'react';
import InsightMindMap from '../modules/insight/InsightMindMap';
import { buildBookTheoryTree, flattenBookTheoryTree, type BookTheoryTreeNode } from '../../utils/bookTheoryTree';
import { generateListenAudio, generateListenContent, getFrameworkEvidence, getListenContent, getListenFramework, listBooks, type BookSummary, type ListenAudio, type ListenContent } from '../../services/bookListenAPI';
import { readBookListenRoute, writeBookListenRoute } from '../../utils/bookListenRouteState';
import BookUploader from './BookUploader';
import BookWorkflowPanel from './BookWorkflowPanel';

export default function BookTheoryPanel() {
  const initialRoute = useMemo(() => readBookListenRoute(window.location.search), []);
  const [books, setBooks] = useState<BookSummary[]>([]); const [bookId, setBookId] = useState(initialRoute.bookId || '');
  const [revisionId, setRevisionId] = useState(''); const [tree, setTree] = useState<BookTheoryTreeNode | null>(null);
  const [selected, setSelected] = useState<BookTheoryTreeNode | null>(null); const [content, setContent] = useState<ListenContent | null>(null);
  const [audio, setAudio] = useState<ListenAudio | null>(null); const [evidenceDetail, setEvidenceDetail] = useState<{ id: string; quote: string; locator: Record<string, unknown>; source_unit_id: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { listBooks().then((items) => { setBooks(items); setBookId((current) => current || items.find((item) => item.active_framework_revision_id)?.id || ''); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (!bookId) return; setContent(null); setAudio(null); const apply = (data: Awaited<ReturnType<typeof getListenFramework>>) => { setRevisionId(data.revision.id); const next = buildBookTheoryTree(data.book.title, data.nodes); const flat = flattenBookTheoryTree(next); setTree(next); setSelected(data.revision.id === initialRoute.revisionId ? flat.find((node) => node.id === initialRoute.nodeId) || flat[0] || null : flat[0] || null); }; getListenFramework(bookId, initialRoute.revisionId).then(apply).catch(() => getListenFramework(bookId).then(apply)).catch((e) => { setTree(null); setError(e.message); }); }, [bookId, initialRoute.nodeId, initialRoute.revisionId]);
  useEffect(() => { if (!selected || !bookId || !revisionId) return; window.history.replaceState(null, '', writeBookListenRoute(window.location.href, { bookId, revisionId, nodeId: selected.id })); setContent(null); setAudio(null); getListenContent(bookId, revisionId, selected.id).then((value) => { setContent(value); setAudio(value.audio || null); }).catch(() => {}); }, [bookId, revisionId, selected]);
  const nodes = useMemo(() => tree ? flattenBookTheoryTree(tree) : [], [tree]);
  const createContent = useCallback(async () => { if (!selected) return; setBusy(true); setError(''); try { setContent(await generateListenContent(bookId, revisionId, selected.id)); } catch (e) { setError(e instanceof Error ? e.message : '生成失败'); } finally { setBusy(false); } }, [bookId, revisionId, selected]);
  const createAudio = useCallback(async () => { if (!selected || !content) return; setBusy(true); setError(''); try { setAudio(await generateListenAudio(bookId, revisionId, selected.id, content.id)); } catch (e) { setError(e instanceof Error ? e.message : '合成失败'); } finally { setBusy(false); } }, [bookId, content, revisionId, selected]);
  return <div className="space-y-3">
    <BookUploader />
    {bookId && <BookWorkflowPanel bookId={bookId} />}
    <label className="block text-xs font-bold text-slate-700">我的书籍<select value={bookId} onChange={(e) => setBookId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="">选择已生成框架的书籍</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {tree && <><div className="h-[360px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900"><InsightMindMap data={tree} ariaLabel="书籍理论框架导图" onNodeSelect={(node) => { if ('id' in node && !String(node.id).startsWith('book:')) setSelected(node as BookTheoryTreeNode); }} /></div>
      <nav aria-label="书籍理论框架树" className="max-h-44 overflow-auto rounded-lg border border-slate-200 p-2"><ul className="space-y-1">{nodes.map((node) => <li key={node.id}><button className="w-full text-left text-xs hover:text-indigo-600" onClick={() => setSelected(node)}>{node.name}</button></li>)}</ul></nav></>}
    {selected && <section className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"><h3 className="font-bold text-slate-900">{selected.name}</h3><p className="text-sm text-slate-700">{selected.summary}</p>
      <div>{selected.evidence.map((item) => <button key={item.id} className="block text-left text-xs text-indigo-700 underline" onClick={async () => { const detail = (await getFrameworkEvidence(bookId, revisionId)).find((candidate) => candidate.id === item.id); if (detail) { setEvidenceDetail(detail); requestAnimationFrame(() => document.getElementById('book-evidence-detail')?.focus()); } }}>证据：{item.quote}</button>)}</div>
      {evidenceDetail && <div id="book-evidence-detail" tabIndex={-1} className="rounded-lg border border-indigo-200 bg-white p-2 text-xs" aria-live="polite"><strong>来源位置</strong><p>来源单元：{evidenceDetail.source_unit_id}</p><p>{JSON.stringify(evidenceDetail.locator)}</p><blockquote>{evidenceDetail.quote}</blockquote></div>}
      <button type="button" onClick={() => { const query = new URLSearchParams(window.location.search); query.set('bookId', bookId); query.set('frameworkRevisionId', revisionId); query.set('frameworkNodeId', selected.id); query.set('trainingMode', 'one_minute_retell'); window.history.pushState(null, '', `${window.location.pathname}?${query}`); window.dispatchEvent(new CustomEvent('navigate-speak')); }} className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-bold text-indigo-700">去表达</button>
      {!content ? <button disabled={busy} onClick={createContent} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">生成听读文字稿</button> : <><p className="whitespace-pre-wrap text-sm text-slate-700">{content.script}</p>{content.stale && <span className="text-xs text-amber-700">历史框架版本</span>}<button disabled={busy} onClick={createAudio} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950">生成语音</button></>}
      {audio && <audio controls src={audio.streamUrl} className="w-full" />}
    </section>}
  </div>;
}
