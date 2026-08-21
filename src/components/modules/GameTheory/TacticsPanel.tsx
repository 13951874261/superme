import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Loader2, BookOpen, X, Film } from 'lucide-react';
import { playClick, playPageTurn, playGentleWarning } from '../../../utils/soundEffects';
import {
  getTactics,
  deleteTactic,
  requestTacticsExportBackground,
  requestTacticsIngestBackground,
  fetchTacticsMedia,
  TacticItem,
} from '../../../services/difyAPI';
import { getAppUserId } from '../../../utils/profileHelper';
import { useTask } from '../../TaskContext';
import { notifyBackgroundHandoff } from '../../../utils/backgroundHandoff';

interface TacticsPanelProps {
  selectedTactics: string[];
  onToggleTactic: (name: string) => void;
}

const MAX_UPLOAD_MB = 200;

export default function TacticsPanel({ selectedTactics, onToggleTactic }: TacticsPanelProps) {
  const { addTask, startPolling } = useTask();
  const [tactics, setTactics] = useState<TacticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [mediaView, setMediaView] = useState<{
    mediaId: string;
    title: string;
    videoUrl: string;
    transcript: string;
  } | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const fetchTactics = async () => {
    setLoading(true);
    try {
      const data = await getTactics();
      setTactics(data);
    } catch (err) {
      console.error('获取手段列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTactics();
  }, []);

  useEffect(() => {
    const onDone = () => { void fetchTactics(); };
    window.addEventListener('tactics-ingest-updated', onDone);
    return () => window.removeEventListener('tactics-ingest-updated', onDone);
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) {
      playGentleWarning();
      return;
    }
    if (uploadFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setUploadStatus(`文件超过 ${MAX_UPLOAD_MB}MB 限制`);
      playGentleWarning();
      return;
    }
    setIsUploading(true);
    setUploadStatus('已提交到任务中心，可关闭弹窗继续操作…');
    playClick();
    try {
      const { taskId } = await requestTacticsIngestBackground(uploadFile);
      addTask({
        id: taskId,
        type: 'tactics_ingest',
        name: `驭人术资料提炼 · ${uploadFile.name.slice(0, 32)}`,
        status: 'pending',
        progress: 0,
        logs: ['任务已创建'],
      });
      startPolling(taskId);
      playPageTurn();
      notifyBackgroundHandoff({
        message: '已加入任务中心：驭人术资料提炼',
        tone: 'success',
      });
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadStatus('');
      }, 1200);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`提交失败: ${errMsg}`);
      playGentleWarning();
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = async () => {
    if (tactics.length === 0) {
      playGentleWarning();
      return;
    }
    if (exporting) return;
    playClick();
    setExporting(true);
    try {
      const { taskId } = await requestTacticsExportBackground(tactics);
      addTask({
        id: taskId,
        type: 'tactics_export',
        name: `导出驭人术手段库 (${tactics.length} 条)`,
        status: 'pending',
        progress: 0,
        logs: ['导出任务已创建'],
      });
      startPolling(taskId);
      notifyBackgroundHandoff({
        message: '导出已加入任务中心',
        tone: 'success',
      });
    } catch (err) {
      playGentleWarning();
      try {
        const { showToast } = await import('../../Toast');
        showToast({ message: err instanceof Error ? err.message : '导出失败', type: 'error' });
      } catch {}
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除手段「${name}」吗？`)) return;
    playClick();
    try {
      await deleteTactic(id);
      await fetchTactics();
    } catch (err) {
      console.error('删除失败:', err);
      playGentleWarning();
    }
  };

  const openMedia = async (t: TacticItem) => {
    if (!t.media_id) return;
    setMediaLoading(true);
    playClick();
    try {
      const media = await fetchTacticsMedia(t.media_id);
      const userId = encodeURIComponent(getAppUserId());
      setMediaView({
        mediaId: t.media_id,
        title: media.sourceName || t.name,
        videoUrl: `/api/tactics_media/${encodeURIComponent(t.media_id)}/file?userId=${userId}`,
        transcript: media.transcript || '',
      });
    } catch (err) {
      playGentleWarning();
      console.error(err);
    } finally {
      setMediaLoading(false);
    }
  };

  const downwardTactics = tactics.filter(t => t.category === 'downward');
  const upwardTactics = tactics.filter(t => t.category === 'upward');

  const renderCard = (t: TacticItem) => (
    <div
      key={t.id}
      onClick={() => onToggleTactic(t.name)}
      className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedTactics.includes(t.name) ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-400'}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold mb-1 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${selectedTactics.includes(t.name) ? 'bg-white' : 'bg-zinc-400'}`} />
          {t.name}
        </h4>
        <div className="flex items-center gap-2">
          {t.media_id && (
            <button
              type="button"
              title="回看视频/转写"
              onClick={(e) => { e.stopPropagation(); void openMedia(t); }}
              className="text-zinc-400 hover:text-sky-500 transition-colors"
            >
              <Film className="w-3 h-3" />
            </button>
          )}
          {t.is_custom === 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }}
              className="text-zinc-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-zinc-600" /> 驭人术手段库
          {loading && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { playClick(); setShowUploadModal(true); }}
            className="flex items-center gap-1 text-[10px] bg-zinc-900 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <Upload className="w-3 h-3" /> 上传资料
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 text-[10px] bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} 导出
          </button>
        </div>
      </div>

      <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
        <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
          上级对下手段
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {downwardTactics.map(renderCard)}
        </div>
      </div>

      <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
        <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
          以下克上手段
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {upwardTactics.map(renderCard)}
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-900">上传驭人术资料</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadStatus(''); }} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mb-4">
              支持 PDF/TXT/MD 或视频（≤{MAX_UPLOAD_MB}MB / ≤30 分钟）。提交后进入任务中心异步提炼；视频可回看并查看转写。
            </p>
            <input
              type="file"
              accept=".pdf,.txt,.md,.text,video/*,.mp4,.webm,.mov,.mkv"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-xs border border-zinc-200 rounded-lg p-2 mb-4"
            />
            {uploadStatus && (
              <p className={`text-[10px] mb-4 ${uploadStatus.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
                {uploadStatus}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="flex items-center gap-1 text-xs bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {isUploading ? '提交中...' : '提交到任务中心'}
              </button>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadStatus(''); }}
                className="text-xs text-zinc-500 px-4 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {(mediaView || mediaLoading) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">{mediaView?.title || '加载中…'}</h3>
              <button onClick={() => setMediaView(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {mediaLoading && !mediaView ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : mediaView ? (
              <div className="space-y-4">
                <video
                  key={mediaView.mediaId}
                  controls
                  className="w-full rounded-xl bg-black max-h-[360px]"
                  src={mediaView.videoUrl}
                />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">转写全文</p>
                  <pre className="text-[11px] text-zinc-700 whitespace-pre-wrap bg-zinc-50 border border-zinc-100 rounded-xl p-3 max-h-64 overflow-y-auto">
                    {mediaView.transcript || '（暂无转写）'}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
