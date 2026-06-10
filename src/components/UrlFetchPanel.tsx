import React, { useState } from 'react';
import { Globe, Loader2, FileText, CheckCircle, AlertTriangle, Eye, X } from 'lucide-react';

interface UrlFetchPanelProps {
  onFetchSuccess: (virtualFile: { name: string; content: string; mimeType: string }) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

export default function UrlFetchPanel({ onFetchSuccess, isLoading, setIsLoading }: UrlFetchPanelProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ title: string; markdown: string } | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  const handlePreview = async () => {
    if (!url.trim()) {
      setError('请输入有效的网页 URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      const response = await fetch(`${API_BASE}/api/materials/fetch-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || '网页提取服务出现异常');
      }

      setPreviewData({
        title: data.title,
        markdown: data.markdown,
      });

      // 移动端全屏弹窗预览，PC端行内展示
      if (window.innerWidth < 768) {
        setShowMobileModal(true);
      }
    } catch (err: any) {
      setError(err.message || '抓取失败，请检查 URL 是否可访问或稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!previewData) return;
    onFetchSuccess({
      name: `${previewData.title.substring(0, 20)}.md`,
      content: previewData.markdown,
      mimeType: 'text/markdown',
    });
    setShowMobileModal(false);
  };

  return (
    <div className="space-y-4">
      {/* URL 输入区 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">网页链接</label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-gray-400">
            <Globe className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴新闻、博客等文章 URL (如 https://www.wsj.com/...)"
            className="w-full pl-10 pr-3 py-3 bg-[#F8F9FA] border border-gray-200 rounded-2xl text-sm transition-all focus:border-[#FF5722] focus:bg-white focus:outline-none"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={isLoading || !url.trim()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 hover:border-[#FF5722] hover:text-[#FF5722] text-xs font-bold tracking-widest uppercase transition-all bg-white text-gray-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#FF5722]" />
              正在提取...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              预览网页内容
            </>
          )}
        </button>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* PC 端内容预览卡片 */}
      {previewData && !showMobileModal && (
        <div className="mt-4 border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-sm transition-all duration-300">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF5722]" />
              <span className="text-xs font-bold text-gray-700 truncate max-w-[250px]">
                {previewData.title}
              </span>
            </div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">
              提取成功
            </span>
          </div>
          <div className="p-4 max-h-48 overflow-y-auto text-xs text-gray-500 font-mono leading-relaxed select-text">
            {previewData.markdown}
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#FF5722] text-white rounded-lg text-xs font-bold tracking-wider hover:bg-[#E64A19] transition-all cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              确认作为提纯材料
            </button>
          </div>
        </div>
      )}

      {/* 移动端全屏弹窗预览 (Modal) */}
      {showMobileModal && previewData && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col md:hidden animate-in fade-in slide-in-from-bottom duration-300">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F8F9FA]">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#FF5722]" />
              <span className="text-sm font-bold text-gray-800 truncate max-w-[200px]">
                网页提取预览
              </span>
            </div>
            <button
              onClick={() => setShowMobileModal(false)}
              className="p-1 rounded-full hover:bg-gray-200 text-gray-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-5 overflow-y-auto select-text">
            <h1 className="text-base font-black text-gray-900 mb-3">{previewData.title}</h1>
            <div className="text-xs text-gray-600 font-mono leading-relaxed whitespace-pre-wrap">
              {previewData.markdown}
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-[#F8F9FA] flex gap-3">
            <button
              onClick={() => setShowMobileModal(false)}
              className="flex-1 py-3 text-center rounded-xl border border-gray-200 text-xs font-bold text-gray-600 bg-white cursor-pointer"
            >
              关闭
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 text-center bg-[#FF5722] text-white rounded-xl text-xs font-bold hover:bg-[#E64A19] cursor-pointer"
            >
              作为提纯材料
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
