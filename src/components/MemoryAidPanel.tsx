import React, { useState, useEffect } from 'react';
import { getMemoryAids, enrichMemory, generateMemoryImage, MemoryAids } from '../services/vocabAPI';
import { Sparkles, Image, RefreshCw, Download, ExternalLink, HelpCircle, FileText, Compass, AlertCircle, Loader2 } from 'lucide-react';

interface MemoryAidPanelProps {
  wordId: string;
  wordText: string;
}

export default function MemoryAidPanel({ wordId, wordText }: MemoryAidPanelProps) {
  const [memoryAids, setMemoryAids] = useState<MemoryAids | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<'root' | 'assoc' | 'phrase' | 'image'>('root');
  const [error, setError] = useState<string | null>(null);

  const fetchMemoryAids = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMemoryAids(wordId);
      if (data && (data.root_memory || data.association_memory || data.mnemonic_phrase)) {
        setMemoryAids(data);
      } else {
        setMemoryAids(null);
      }
    } catch (e: any) {
      console.error(e);
      setError('加载记忆辅助失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemoryAids();
  }, [wordId]);

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await enrichMemory(wordId);
      setMemoryAids(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || '调用AI记忆引擎失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!memoryAids?.image_prompt) return;
    setIsGeneratingImage(true);
    setError(null);
    try {
      const res = await generateMemoryImage(wordId);
      if (res.success) {
        setMemoryAids(prev => prev ? {
          ...prev,
          image_url: res.image_url,
          download_url: res.download_url
        } : null);
      } else {
        setError('图片生成失败');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || '绘制记忆图片失败，请检查网络或重试');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 渲染图片 Tab 的特定状态
  const renderImageTab = () => {
    if (isGeneratingImage) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <div className="text-xs font-bold text-slate-700">AI 正在绘制脑海记忆图...</div>
          <div className="text-[10px] text-slate-400 mt-1.5">预计需要 10 ~ 15 秒，请稍候</div>
          <div className="w-48 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 h-full rounded-full animate-pulse" style={{ width: '70%' }}></div>
          </div>
        </div>
      );
    }

    if (!memoryAids?.image_prompt) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
          <div className="text-xs text-slate-500 font-medium">请先在下方点击「生成 AI 记忆脑图」以获取图片提示词</div>
        </div>
      );
    }

    if (!memoryAids.image_url) {
      return (
        <div className="space-y-4">
          <div className="bg-slate-900/5 border border-slate-900/10 rounded-xl p-3.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">图片设计方案 (Prompt)</div>
            <p className="text-xs text-slate-600 font-mono leading-relaxed select-all">
              {memoryAids.image_prompt}
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleGenerateImage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase text-white bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:opacity-95 shadow-md active:scale-95 transition-all select-none"
            >
              <Sparkles className="w-4 h-4" />
              生成记忆图片
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
          <img
            src={memoryAids.image_url}
            alt={`${wordText} memory aid`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <span className="text-[10px] text-white/90 font-mono truncate max-w-[70%] bg-black/30 backdrop-blur-sm px-2 py-1 rounded">
              {memoryAids.image_prompt}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleGenerateImage}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-orange-500 hover:bg-orange-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
            title="使用原有 prompt 重新绘制配图"
          >
            <RefreshCw className="w-3 h-3" />
            重新生成
          </button>
          <a
            href={memoryAids.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-500 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
          >
            <ExternalLink className="w-3 h-3" />
            原图
          </a>
          <a
            href={memoryAids.download_url || memoryAids.image_url}
            download={`${wordText}_memory.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
          >
            <Download className="w-3 h-3" />
            下载
          </a>
        </div>
      </div>
    );
  };

  // 主框架渲染
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-left select-text relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-[#FF5722] animate-spin mb-2" />
          <span className="text-xs font-bold text-slate-500">AI 正在精心梳理记忆法...</span>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs p-2.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {!memoryAids ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-amber-500 animate-pulse mb-2.5" />
          <div className="text-xs font-bold text-slate-700">暂无 AI 记忆辅助内容</div>
          <div className="text-[10px] text-slate-400 mt-1 max-w-[240px]">
            点击下方按钮，我们将为您深度提取此单词的词根词缀、趣味联想与助记画面。
          </div>
          <button
            onClick={handleEnrich}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-[#FF5722] hover:opacity-95 shadow-md transition-all active:scale-95 select-none"
          >
            <Sparkles className="w-3.5 h-3.5" />
            生成 AI 记忆脑图
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tab 导航头 */}
          <div className="flex border-b border-slate-100 pb-1">
            <button
              onClick={() => setActiveTab('root')}
              className={`flex-1 text-[11px] font-black pb-1.5 border-b-2 text-center transition-all ${activeTab === 'root' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              词根词缀
            </button>
            <button
              onClick={() => setActiveTab('assoc')}
              className={`flex-1 text-[11px] font-black pb-1.5 border-b-2 text-center transition-all ${activeTab === 'assoc' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              联想记忆
            </button>
            <button
              onClick={() => setActiveTab('phrase')}
              className={`flex-1 text-[11px] font-black pb-1.5 border-b-2 text-center transition-all ${activeTab === 'phrase' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              助记短语
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 text-[11px] font-black pb-1.5 border-b-2 text-center transition-all ${activeTab === 'image' ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              图片记忆
            </button>
          </div>

          {/* Tab 内容区 */}
          <div className="min-h-[120px] pt-1">
            {activeTab === 'root' && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                <div className="text-[10px] font-bold text-orange-500 tracking-wider uppercase mb-1 select-none flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  词根词缀剖析
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {memoryAids.root_memory || '暂无词根解析'}
                </p>
              </div>
            )}

            {activeTab === 'assoc' && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                <div className="text-[10px] font-bold text-orange-500 tracking-wider uppercase mb-1 select-none flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  联想记忆网络
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {memoryAids.association_memory || '暂无联想逻辑'}
                </p>
              </div>
            )}

            {activeTab === 'phrase' && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                <div className="text-[10px] font-bold text-orange-500 tracking-wider uppercase mb-1 select-none flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  助记实用短语
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {memoryAids.mnemonic_phrase || '暂无助记短语'}
                </p>
              </div>
            )}

            {activeTab === 'image' && renderImageTab()}
          </div>

          {/* 重新触发 AI 生成的底栏 */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1 select-none">
            <span className="text-[9px] text-slate-400 font-medium">
              {memoryAids.generated_at ? `上次生成时间: ${new Date(memoryAids.generated_at).toLocaleString()}` : ''}
            </span>
            <button
              onClick={handleEnrich}
              disabled={isGeneratingImage}
              className="flex items-center gap-1 text-[10px] font-bold text-[#FF5722] hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg transition"
            >
              <RefreshCw className="w-3 h-3" />
              重新生成 AI 记忆
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
