import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMemoryAids, enrichMemory, generateMemoryImage, MemoryAids } from '../services/vocabAPI';
import { Sparkles, Image, RefreshCw, Download, ExternalLink, HelpCircle, FileText, Compass, AlertCircle, Loader2 } from 'lucide-react';

interface MemoryAidPanelProps {
  wordId: string;
  wordText: string;
  /** tabs=默认横向；reviewStack=生词复习四卡同时展开 */
  variant?: 'tabs' | 'reviewStack';
  /** reviewStack：把第 i 张卡 DOM 交给父级做 GSAP 顶边贴合 */
  assignCardRef?: (index: number) => (el: HTMLDivElement | null) => void;
  stackClassName?: string;
}

export default function MemoryAidPanel({
  wordId,
  wordText,
  variant = 'tabs',
  assignCardRef,
  stackClassName,
}: MemoryAidPanelProps) {
  const [memoryAids, setMemoryAids] = useState<MemoryAids | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<'root' | 'assoc' | 'phrase' | 'image'>('root');
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLightbox, setImageLightbox] = useState(false);

  const fetchMemoryAids = async () => {
    setIsLoading(true);
    setError(null);
    setImageError(null);
    try {
      const data = await getMemoryAids(wordId);
      if (data && (data.root_memory || data.association_memory || data.mnemonic_phrase)) {
        setMemoryAids(data);
      } else {
        // 无缓存：空态 +「生成 AI 记忆脑图」，不报加载失败
        setMemoryAids(null);
      }
    } catch (e: any) {
      // 加载失败（含鉴权/网络）也不弹粉框，引导用户重新生成并写入生词本
      console.error(e);
      setMemoryAids(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setImageLightbox(false);
    fetchMemoryAids();
  }, [wordId]);

  const handleEnrich = async () => {
    setIsLoading(true);
    setError(null);
    setImageError(null);
    try {
      const data = await enrichMemory(wordId);
      setMemoryAids(data);
      // 分发事件通知其他组件（如生词本和解密舱）刷新最新的 payload 与词义数据
      window.dispatchEvent(new Event('vocab-updated'));
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || '');
      if (msg.includes('aborted') || e?.name === 'AbortError') {
        setError('AI 记忆构建生成中，请重试');
      } else {
        setError(msg || '调用AI记忆引擎失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!memoryAids?.image_prompt) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const res = await generateMemoryImage(wordId);
      if (res.success) {
        setMemoryAids(prev => prev ? {
          ...prev,
          image_url: res.image_url,
          download_url: res.download_url
        } : null);
      } else {
        setImageError('图片生成失败');
      }
    } catch (e: any) {
      console.error(e);
      setImageError(e.message || '绘制记忆图片失败，请检查网络或重试');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 渲染图片 Tab 的特定状态
  const renderImageTab = () => {
    // 图片 Tab 专属错误展示（拦截 "Failed to fetch" 并给用户友好提示）
    if (imageError) {
      const isNetError = imageError === 'Failed to fetch' || imageError.includes('Failed to fetch');
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-xs p-3.5 rounded-xl animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-black text-red-700 mb-0.5">
                {isNetError ? '网络请求失败' : '配图生成失败'}
              </div>
              <div className="font-medium">
                {isNetError
                  ? '无法连接到后端服务，请确认 vocab-server 已启动且网络正常。'
                  : imageError}
              </div>
            </div>
          </div>
          {!memoryAids?.image_prompt ? null : !memoryAids.image_url ? (
            <div className="bg-slate-900/5 border border-slate-900/10 rounded-xl p-3.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">图片设计方案 (Prompt)</div>
              <p className="text-xs text-slate-600 font-mono leading-relaxed select-all">
                {memoryAids.image_prompt}
              </p>
            </div>
          ) : null}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleGenerateImage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase text-white bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:opacity-95 shadow-md active:scale-95 transition-all select-none"
            >
              <Sparkles className="w-4 h-4" />
              重新生成配图
            </button>
          </div>
        </div>
      );
    }

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
        <button
          type="button"
          onClick={() => setImageLightbox(true)}
          className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group block text-left cursor-zoom-in"
        >
          <img
            src={memoryAids.image_url}
            alt={`记忆助手插图: ${wordText}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
            <span className="text-[10px] text-white/90 font-mono truncate max-w-[70%] bg-black/30 backdrop-blur-sm px-2 py-1 rounded">
              {memoryAids.image_prompt}
            </span>
          </div>
        </button>

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

        {imageLightbox && memoryAids.image_url && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4 cursor-zoom-out"
                onClick={() => setImageLightbox(false)}
                role="dialog"
                aria-modal="true"
                aria-label="点击还原图片"
              >
                <img
                  src={memoryAids.image_url}
                  alt={`记忆助手大图: ${wordText}`}
                  className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
                />
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  };

  const renderReviewStackCard = (
    index: number,
    title: string,
    icon: React.ReactNode,
    body: React.ReactNode,
  ) => (
    <div
      key={title}
      ref={assignCardRef?.(index)}
      data-memory-card={index}
      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left"
    >
      <div className="text-[10px] font-bold text-orange-500 tracking-wider uppercase mb-1 select-none flex items-center gap-1">
        {icon}
        {title}
      </div>
      <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{body}</div>
    </div>
  );

  if (variant === 'reviewStack') {
    return (
      <div className={`text-left select-text ${stackClassName || 'flex flex-col gap-2'}`}>
        {isLoading && (
          <div className="flex flex-col items-center justify-center z-10 min-h-[80px] py-4">
            <Loader2 className="w-7 h-7 text-[#FF5722] animate-spin mb-2" />
            <span className="text-[11px] font-bold text-slate-500">AI 正在梳理记忆法...</span>
          </div>
        )}

        {error && (
          <div className="mb-1 flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-[11px] p-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {!memoryAids ? (
          <>
            {renderReviewStackCard(0, '词根词缀', <Compass className="w-3.5 h-3.5" />, '生成后显示词根剖析')}
            {renderReviewStackCard(1, '联想记忆', <Sparkles className="w-3.5 h-3.5" />, '生成后显示联想网络')}
            {renderReviewStackCard(2, '助记短语', <FileText className="w-3.5 h-3.5" />, '生成后显示助记短语')}
            {renderReviewStackCard(3, '图片记忆', <Image className="w-3.5 h-3.5" />, '生成后显示记忆配图')}
            <button
              onClick={handleEnrich}
              className="memory-stack-footer mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white bg-gradient-to-r from-orange-500 to-[#FF5722] hover:opacity-95 shadow-sm transition-all active:scale-95 select-none"
            >
              <Sparkles className="w-3.5 h-3.5" />
              生成 AI 记忆脑图
            </button>
          </>
        ) : (
          <>
            {renderReviewStackCard(
              0,
              '词根词缀',
              <Compass className="w-3.5 h-3.5" />,
              memoryAids.root_memory || '暂无词根解析',
            )}
            {renderReviewStackCard(
              1,
              '联想记忆',
              <Sparkles className="w-3.5 h-3.5" />,
              memoryAids.association_memory || '暂无联想逻辑',
            )}
            {renderReviewStackCard(
              2,
              '助记短语',
              <FileText className="w-3.5 h-3.5" />,
              memoryAids.mnemonic_phrase || '暂无助记短语',
            )}
            <div ref={assignCardRef?.(3)} data-memory-card={3} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
              <div className="text-[10px] font-bold text-orange-500 tracking-wider uppercase mb-1 select-none flex items-center gap-1">
                <Image className="w-3.5 h-3.5" />
                图片记忆
              </div>
              {renderImageTab()}
            </div>
            <div className="memory-stack-footer flex items-center justify-between border-t border-slate-100 pt-2 select-none">
              <span className="text-[9px] text-slate-400 font-medium">
                {memoryAids.generated_at ? `上次生成: ${new Date(memoryAids.generated_at).toLocaleString()}` : ''}
              </span>
              <button
                onClick={handleEnrich}
                disabled={isGeneratingImage}
                className="flex items-center gap-1 text-[10px] font-bold text-[#FF5722] hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition"
              >
                <RefreshCw className="w-3 h-3" />
                重新生成 AI 记忆
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // 主框架渲染（tabs）
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
            点击下方按钮生成词根词缀、联想与助记；生成结果会缓存到生词本，下次打开直接读取。
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
