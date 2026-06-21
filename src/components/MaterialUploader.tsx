import React, { useRef, useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, UploadCloud, Zap, Globe, Video, Play, Sparkles } from 'lucide-react';
import { processMaterialsAndExtract } from '../services/difyAPI';
import UrlFetchPanel from './UrlFetchPanel';
import VideoTranscribePanel from './VideoTranscribePanel';
import { useTask } from './TaskContext';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: (fileName: string) => void;
  onExtractionSuccess?: (data?: { article: string, words: string[], phrases: string[], sentences?: string[] }) => void;
}

type WorkflowStatus = 'idle' | 'running' | 'success' | 'error';
type TabType = 'file' | 'url' | 'video';

function nowLabel() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export default function MaterialUploader({
  topicHint = '政商务外刊/信函',
  onUploadSuccess,
  onExtractionSuccess,
}: MaterialUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [currentStep, setCurrentStep] = useState('等待选择材料');
  const [currentFileName, setCurrentFileName] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('file');

  // 用于保存文本文件的预览字串
  const [previewContent, setPreviewContent] = useState<string>('');
  // 用于保存来自视频面板 of 媒体预览状态
  const [videoMedia, setVideoMedia] = useState<{ type: 'file' | 'url'; file?: File; url?: string } | null>(null);
  // 用于视频文件本地播放的 Object URL
  const [videoObjectURL, setVideoObjectURL] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addTask } = useTask();

  const appendLog = (message: string) => {
    setLogs(prev => [...prev, `${nowLabel()} ${message}`]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    setSelectedFiles(files);
    setStatus('idle');
    setCurrentFileName(files[0]?.name || '');
    setCurrentStep(files.length > 0 ? `已选择 ${files.length} 个文件` : '等待选择材料');
    setLogs(files.length > 0 ? [`${nowLabel()} 已选择主题：${topicHint}`, `${nowLabel()} 已选择 ${files.length} 个文件`] : []);
  };

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 统一提纯工作流方法，可接受外部传入的虚拟文件
  const runExtractionForFiles = async (files: File[]) => {
    if (files.length === 0 || status === 'running') return;

    setStatus('running');
    setShowLogs(true);
    setCurrentStep('后端正在执行：清库 → 上传 → 向量化 → 提纯 → 入库');
    setLogs([`${nowLabel()} 启动卡片向导式一键提纯流程`]);

    try {
      const result = await processMaterialsAndExtract(files, topicHint, 'default-user');

      // 拿到 taskId 后，直接推入全局任务中心上下文托管轮询
      addTask({
        id: result.taskId,
        type: 'material',
        name: `材料提纯: ${files[files.length - 1]?.name || '多个文档'}`,
        status: 'pending',
        progress: 5,
        logs: [`[${nowLabel()}] 提纯任务已在后台建立，正在排队清库...`]
      });

      // UI 界面提示用户关注任务中心
      setStatus('idle');
      setCurrentStep('已成功将提纯任务提交到后台，请在顶栏「提纯任务中心」追踪具体进度');
      setLogs([
        `${nowLabel()} 异步提纯任务建立成功，TaskId: ${result.taskId}`,
        `${nowLabel()} 正在清空旧向量并上传新文件，请前往任务中心查阅流式日志`
      ]);

      resetInput();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      appendLog(`处理失败：${message}`);
      setStatus('error');
      setCurrentStep(`处理失败：${message}`);
    }
  };

  const handleRunWorkflow = () => {
    runExtractionForFiles(selectedFiles);
  };

  // URL 提取成功回调
  const handleUrlFetchSuccess = (virtualFile: { name: string; content: string; mimeType: string }) => {
    const file = new File([virtualFile.content], virtualFile.name, { type: virtualFile.mimeType });
    setSelectedFiles([file]);
    setPreviewContent(virtualFile.content);
    setCurrentFileName(virtualFile.name);
    setCurrentStep(`已加载网页提取材料：${virtualFile.name}`);
    setLogs([
      `${nowLabel()} 网页数据抓取并过滤成功`,
      `${nowLabel()} 虚拟材料就绪，点击 Step 3 即可执行 Dify 提纯入库`
    ]);
  };

  // 视频异步转写任务创建成功回调
  const handleVideoTaskCreated = (taskId: string) => {
    addTask({
      id: taskId,
      type: 'video',
      name: `转写任务: ${taskId.substring(0, 8)}...`,
      status: 'pending',
      progress: 5,
      logs: [`[${new Date().toISOString()}] 任务已在后台建立，正在排队排期...`],
    });

    setCurrentStep('已异步发起视频转写。请在顶栏「提纯任务中心」追踪完成状态。');
    setLogs([
      `${nowLabel()} 后台转写任务建立成功，TaskId: ${taskId}`,
      `${nowLabel()} 进程将在服务器异步执行，无需在本页面等待。`,
      `${nowLabel()} 视频处理完毕后可从「任务中心」一键导入进行 Dify 最终提纯。`
    ]);
  };

  // 切换 Tab 时清理状态，避免相互干扰
  useEffect(() => {
    if (activeTab === 'video') {
      setSelectedFiles([]);
      resetInput();
    } else {
      setVideoMedia(null);
    }
  }, [activeTab]);

  // 监听选中的文件以实时生成预览内容
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviewContent('');
      return;
    }
    const file = selectedFiles[0];
    const isText = file.type.startsWith('text/') || 
                   file.name.endsWith('.txt') || 
                   file.name.endsWith('.md') ||
                   file.name.endsWith('.json') ||
                   file.name.endsWith('.srt') ||
                   file.name.endsWith('.vtt') ||
                   file.type === 'text/markdown';
    if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewContent(e.target?.result as string || '');
      };
      reader.readAsText(file, 'utf-8');
    } else {
      setPreviewContent('');
    }
  }, [selectedFiles]);

  // 处理视频 Blob URL 的 Effect
  useEffect(() => {
    if (videoMedia?.type === 'file' && videoMedia.file) {
      const url = URL.createObjectURL(videoMedia.file);
      setVideoObjectURL(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoObjectURL('');
    }
  }, [videoMedia]);

  // 监听并承接全局任务中心 Drawer 中的“导入并提纯”事件
  useEffect(() => {
    const handleGlobalImport = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { name, content, mimeType } = customEvent.detail;
        const file = new File([content], name, { type: mimeType });
        setSelectedFiles([file]);
        setCurrentFileName(name);
        setCurrentStep(`已从任务中心导入并自动触发提纯：${name}`);
        // 自动执行 Dify 提纯提取流程
        runExtractionForFiles([file]);
      }
    };

    window.addEventListener('import-virtual-material', handleGlobalImport);
    return () => window.removeEventListener('import-virtual-material', handleGlobalImport);
  }, [topicHint]);

  const progress = status === 'success' ? 100 : status === 'running' ? 65 : selectedFiles.length > 0 ? 25 : 0;

  return (
    <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-8 shadow-[var(--shadow-card)] mt-8 space-y-6">
      <div>
        <h4 className="text-sm font-black uppercase tracking-widest text-[var(--color-surface-dark)] mb-2 flex items-center leading-none">
          <UploadCloud className="w-5 h-5 mr-2 text-[var(--color-primary)]" />
          一键材料提纯
        </h4>
        <p className="text-xs text-gray-400 font-medium leading-relaxed mt-2">
          将本地文档、网页内容或音视频转写文字投喂给 Dify 知识库，并自动写入艾宾浩斯生词本。
        </p>
      </div>

      {/* Step 1：当前主题 — 水平通栏 Banner */}
      <section className="rounded-[var(--radius-md)] bg-gradient-to-r from-slate-50 to-slate-100/50 border border-[var(--color-border)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-lg shrink-0">
            Step 1
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              当前主题：
            </span>
            <span className="text-sm font-black text-[var(--color-surface-dark)] leading-relaxed">{topicHint}</span>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 font-medium shrink-0 relative z-10">来源：上方 Theme Gateway</div>
      </section>

      {/* Step 2 + Step 3：等比两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Step 2：选择材料 (左栏) */}
        <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface-mid)] border border-[var(--color-border)] p-5 flex flex-col min-h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-3">Step 2 选择材料</div>
            
            {/* Tabs Selector */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4 bg-white">
              <button
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'file' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-gray-500 hover:bg-zinc-50 hover:shadow-sm'
                }`}
                disabled={status === 'running'}
              >
                <FileText className="w-3.5 h-3.5" />
                本地文档
              </button>
              <button
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'url' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-gray-500 hover:bg-zinc-50 hover:shadow-sm'
                }`}
                disabled={status === 'running'}
              >
                <Globe className="w-3.5 h-3.5" />
                网页提取
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'video' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-gray-500 hover:bg-zinc-50 hover:shadow-sm'
                }`}
                disabled={status === 'running'}
              >
                <Video className="w-3.5 h-3.5" />
                视频字幕
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'file' && (
              <div className="space-y-3">
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.md"
                  className="hidden"
                  id="material-wizard-upload"
                  disabled={status === 'running'}
                />
                <label
                  htmlFor="material-wizard-upload"
                  className={`group flex flex-col items-center justify-center px-4 py-8 rounded-xl text-xs font-black tracking-widest uppercase transition-all border-2 border-dashed cursor-pointer ${
                    status === 'running'
                      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-[var(--color-surface-dark)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:shadow-[0_0_0_3px_var(--color-primary-light)]'
                  }`}
                >
                  <UploadCloud className="w-8 h-8 mb-2 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                  选择本地文档
                  <span className="text-[10px] text-gray-400 leading-relaxed font-medium mt-1 normal-case tracking-normal">
                    支持 PDF / Word / TXT / MD 格式
                  </span>
                </label>
              </div>
            )}

            {activeTab === 'url' && (
              <UrlFetchPanel 
                onFetchSuccess={handleUrlFetchSuccess}
                isLoading={status === 'running'}
                setIsLoading={(loading) => setStatus(loading ? 'running' : 'idle')}
              />
            )}

            {activeTab === 'video' && (
              <VideoTranscribePanel 
                topicHint={topicHint}
                onTaskCreated={handleVideoTaskCreated}
                onMediaChange={setVideoMedia}
              />
            )}

            {/* 选中材料回显 (针对本地文档 & 网页提取) */}
            {activeTab !== 'video' && selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">当前载入的提纯材料</div>
                {selectedFiles.map(file => (
                  <div key={file.name} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[var(--color-border)] shadow-sm hover:shadow-[var(--shadow-hover)] transition-shadow">
                    <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                    <span className="text-xs font-medium text-gray-700 truncate flex-1">{file.name}</span>
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />已载入
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Step 3：执行提纯 (右栏) */}
        <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface-dark)] border border-zinc-800 p-5 text-white flex flex-col justify-between min-h-[420px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-3">Step 3 执行与预览</div>
            
            {/* 动态预览窗口 */}
            <div className="flex-1 min-h-[160px] max-h-[200px] mb-4 bg-zinc-950 rounded-xl p-4 border border-zinc-800 flex flex-col overflow-hidden relative shadow-inner">
              {activeTab === 'video' && videoMedia ? (
                // 视频及字幕预览
                <div className="flex-grow flex flex-col justify-center min-h-0">
                  <div className="text-[9px] text-zinc-500 mb-1.5 truncate">
                    {videoMedia.type === 'file' ? `本地视频: ${videoMedia.file?.name}` : `网络视频: ${videoMedia.url}`}
                  </div>
                  {selectedFiles.length > 0 ? (
                    <div className="flex-grow flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-zinc-800 text-[9px] text-zinc-500">
                        <span className="truncate max-w-[130px]">{selectedFiles[0].name}</span>
                        <span className="font-mono">字幕已就绪</span>
                      </div>
                      <div className="flex-grow overflow-y-auto text-[10px] text-zinc-300 font-mono leading-relaxed pr-1 whitespace-pre-wrap break-all custom-scrollbar">
                        {previewContent || '字幕转写内容正在装载...'}
                      </div>
                    </div>
                  ) : videoMedia.type === 'file' && videoObjectURL ? (
                    <video src={videoObjectURL} controls className="w-full max-h-[110px] rounded-lg bg-black border border-zinc-800" />
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-lg p-3">
                      <Play className="w-6 h-6 text-zinc-700 mb-1 animate-pulse" />
                      <span className="text-[9px] text-zinc-500">视频链接已就绪，请在左侧点击“提取字幕并导入”</span>
                    </div>
                  )}
                </div>
              ) : selectedFiles.length > 0 ? (
                // 文本/网页/导入文件预览
                <div className="flex-grow flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-zinc-800 text-[9px] text-zinc-500">
                    <span className="truncate max-w-[130px]">{selectedFiles[0].name}</span>
                    <span className="font-mono">{(selectedFiles[0].size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="flex-grow overflow-y-auto text-[10px] text-zinc-300 font-mono leading-relaxed pr-1 whitespace-pre-wrap break-all custom-scrollbar">
                    {previewContent ? (
                      previewContent
                    ) : (
                      <span className="text-zinc-500 italic block py-2">
                        [ 无法直接预览二进制文档 ]
                        {"\n\n"}PDF / Word / DOCX 等二进制数据，将在点击下方“开始上传并提纯”后，由后台智能服务进行结构化解析与知识向量切片。
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
                </div>
              ) : (
                // 默认提示
                <div className="flex-grow flex flex-col items-center justify-center text-center p-2">
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                    系统将自动执行：清空知识库 → 载入材料 → 向量化切片 → Dify 智能抽提词汇 → 写入艾宾浩斯生词本。
                  </p>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleRunWorkflow}
            disabled={selectedFiles.length === 0 || status === 'running'}
            className={`w-full px-5 py-3.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
              selectedFiles.length === 0 || status === 'running'
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-[0.98] active:translate-y-[1px] cursor-pointer shadow-md hover:shadow-lg'
            }`}
          >
            {status === 'running' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />处理中...</>
            ) : status === 'success' ? (
              <><CheckCircle2 className="w-4 h-4" />再次执行</>
            ) : (
              <><Zap className="w-4 h-4" />开始上传并提纯</>
            )}
          </button>
        </section>
      </div>

      {/* 底部详细进度日志区 */}
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-mid)] border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">当前进度</div>
            <div className="text-sm font-bold text-[var(--color-surface-dark)] truncate max-w-[280px]">
              {currentFileName || '等待材料...'}
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            status === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'error'
                ? 'bg-red-100 text-red-650'
                : status === 'running'
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                  : 'bg-gray-150 text-gray-400'
          }`}
          >
            {status === 'idle' ? '等候中' : status}
          </span>
        </div>

        {/* 进度条 — 加粗 + 圆角 + 内阴影 */}
        <div className="h-3 bg-zinc-200 rounded-xl overflow-hidden mb-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] to-amber-400 rounded-xl transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 font-medium leading-relaxed">{currentStep}</div>

        <button
          onClick={() => setShowLogs(prev => !prev)}
          className="mt-4 flex items-center text-[11px] font-black uppercase tracking-widest text-gray-450 hover:text-[var(--color-surface-dark)] transition-colors cursor-pointer"
        >
          {showLogs ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          查看提纯流水线详细日志
        </button>

        {showLogs && (
          <div className="mt-3 bg-zinc-900 text-zinc-300 rounded-xl p-4 max-h-52 overflow-y-auto text-[11px] font-mono space-y-1 shadow-inner custom-scrollbar">
            {logs.length > 0 ? logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <div>等待任务启动...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
