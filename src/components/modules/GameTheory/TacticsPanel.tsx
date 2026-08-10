import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Loader2, BookOpen, Plus, X } from 'lucide-react';
import { playClick, playPageTurn, playGentleWarning } from '../../../utils/soundEffects';
import {
  getTactics,
  addTactic,
  deleteTactic,
  uploadTacticsMaterial,
  exportTacticsToCsv,
  TacticItem,
} from '../../../services/difyAPI';
import { getAppUserId } from '../../../utils/profileHelper';

interface TacticsPanelProps {
  selectedTactics: string[];
  onToggleTactic: (name: string) => void;
}

export default function TacticsPanel({ selectedTactics, onToggleTactic }: TacticsPanelProps) {
  const [tactics, setTactics] = useState<TacticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

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

  const handleUpload = async () => {
    if (!uploadFile) {
      playGentleWarning();
      return;
    }
    setIsUploading(true);
    setUploadStatus('正在上传并提取知识点...');
    playClick();
    try {
      const result = await uploadTacticsMaterial(uploadFile);
      setUploadStatus(`成功提取 ${result.inserted} 条手段！`);
      playPageTurn();
      await fetchTactics();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadStatus('');
      }, 2000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`提取失败: ${errMsg}`);
      playGentleWarning();
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    if (tactics.length === 0) {
      playGentleWarning();
      return;
    }
    playClick();
    exportTacticsToCsv(tactics);
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

  const downwardTactics = tactics.filter(t => t.category === 'downward');
  const upwardTactics = tactics.filter(t => t.category === 'upward');

  return (
    <div className="space-y-6">
      {/* Header with actions */}
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
            className="flex items-center gap-1 text-[10px] bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Download className="w-3 h-3" /> 导出
          </button>
        </div>
      </div>

      {/* Downward Tactics */}
      <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
        <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
          上级对下手段
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {downwardTactics.map(t => (
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
                {t.is_custom === 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upward Tactics */}
      <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
        <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
          以下克上手段
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {upwardTactics.map(t => (
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
                {t.is_custom === 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Modal */}
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
              上传 PDF 或 TXT 格式的书籍/材料，AI 将自动提取其中的驭人手段和博弈技巧。
            </p>
            <input
              type="file"
              accept=".pdf,.txt,.md,.text"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-xs border border-zinc-200 rounded-lg p-2 mb-4"
            />
            {uploadStatus && (
              <p className={`text-[10px] mb-4 ${uploadStatus.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
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
                {isUploading ? '提取中...' : '开始提取'}
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
    </div>
  );
}
