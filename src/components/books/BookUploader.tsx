import { useEffect, useRef, useState } from 'react';
import { uploadBook, type BookUploadResult } from '../../services/bookUploadAPI';

const formats = '.pdf,.epub,.mobi,.azw3,.txt';
export default function BookUploader() {
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [result, setResult] = useState<BookUploadResult | null>(null); const [remaining, setRemaining] = useState(3); const opened = useRef(false); const acceptedAt = useRef(0);
  const openTask = (value = result) => {
    if (!value || opened.current) return; opened.current = true;
    const url = new URL(window.location.href); url.searchParams.set('bookId', value.bookId); url.searchParams.set('jobId', value.jobId); window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new CustomEvent('open-book-job', { detail: value }));
  };
  useEffect(() => {
    if (!result) return; const deadline = acceptedAt.current + 3000;
    const tick = () => { const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setRemaining(left); if (!left) openTask(result); };
    tick(); const timer = window.setInterval(tick, 250); return () => window.clearInterval(timer);
  }, [result]);
  const submit = async () => { if (!file) return; setBusy(true); setError(''); opened.current = false; try { const uploaded = await uploadBook(file); acceptedAt.current = Date.now(); setRemaining(3); setResult(uploaded); } catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败'); } finally { setBusy(false); } };
  return <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
    <div><h3 className="text-sm font-black text-slate-900">上传轻量书籍</h3><p className="text-xs text-slate-500">文本型 PDF / EPUB / MOBI / AZW3 ≤ 8 MiB，TXT ≤ 4 MiB；展开正文 ≤ 200 万字符。扫描 PDF 暂不支持。</p></div>
    <input aria-label="选择书籍" type="file" accept={formats} disabled={busy || !!result} onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }} className="block w-full text-xs" />
    {!result && <button type="button" disabled={!file || busy} onClick={submit} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? '安全上传中…' : '上传并解析'}</button>}
    {result && <div role="status" aria-live="polite" className="rounded-lg bg-white p-3 text-xs text-slate-700"><p className="font-bold">上传成功，{remaining} 秒后进入任务中心</p><p className="mt-1 break-all text-slate-500">任务 ID：{result.jobId}</p><button type="button" onClick={() => openTask()} className="mt-2 rounded-lg border border-indigo-300 px-3 py-1.5 font-bold text-indigo-700 focus-visible:outline focus-visible:outline-2">立即查看任务</button></div>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
  </section>;
}
