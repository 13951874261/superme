import React, { useRef, useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, UploadCloud, Zap, Globe, Video } from 'lucide-react';
import { processMaterialsAndExtract } from '../services/difyAPI';
import UrlFetchPanel from './UrlFetchPanel';
import VideoTranscribePanel from './VideoTranscribePanel';
import { useTask } from './TaskContext';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: (fileName: string) => void;
  onExtractionSuccess?: () => void;
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
      setLogs(result.logs || []);
      const lastResult = result.results?.[result.results.length - 1];
      setCurrentFileName(lastResult?.fileName || files[files.length - 1]?.name || '全部文件');
      setStatus('success');
      setCurrentStep('全部处理完成');
      files.forEach(file => onUploadSuccess?.(file.name));
      window.dispatchEvent(new Event('vocab-updated'));
      onExtractionSuccess?.();
      resetInput();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      const serverLogs = (error as Error & { logs?: string[] }).logs;
      if (serverLogs?.length) {
        setLogs(serverLogs);
      } else {
        appendLog(`处理失败：${message}`);
      }
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
    <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm mt-8 space-y-6">
      <div>
        <h4 className="text-sm font-black uppercase tracking-widest text-[#202124] mb-2 flex items-center">
          <UploadCloud className="w-5 h-5 mr-2 text-[#FF5722]" />
          一键材料提纯
        </h4>
        <p className="text-xs text-gray-400 font-medium leading-relaxed">
          将本地文档、网页内容或音视频转写文字投喂给 Dify 知识库，并自动写入艾宾浩斯生词本。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Step 1：当前主题 */}
        <section className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-3">Step 1 当前主题</div>
            <div className="text-sm font-black text-[#202124] leading-relaxed">{topicHint}</div>
          </div>
          <div className="text-[11px] text-gray-400 mt-4">来源：上方 Theme Gateway</div>
        </section>

        {/* Step 2：选择材料 (Tabs 重构) */}
        <section className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5 flex flex-col justify-between lg:col-span-1">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3">Step 2 选择材料</div>
            
            {/* Tabs Selector */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4 bg-white">
              <button
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'file' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
                disabled={status === 'running'}
              >
                <FileText className="w-3.5 h-3.5" />
                本地文档
              </button>
              <button
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'url' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
                disabled={status === 'running'}
              >
                <Globe className="w-3.5 h-3.5" />
                网页提取
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  activeTab === 'video' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
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
                  className={`flex items-center justify-center px-4 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all border cursor-pointer ${
                    status === 'running'
                      ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                      : 'bg-white text-[#202124] border-gray-200 hover:border-[#FF5722] hover:text-[#FF5722]'
                  }`}
                >
                  <FileText className="w-4 h-4 mr-2" />选择本地文档
                </label>
                <div className="text-[10px] text-gray-400 leading-relaxed">
                  支持 PDF / Word / TXT / MD 格式
                </div>
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
                onTaskCreated={handleVideoTaskCreated}
              />
            )}

            {/* 选中材料回显 (针对本地文档 & 网页提取) */}
            {activeTab !== 'video' && selectedFiles.length > 0 && (
              <div className="mt-4 space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">当前载入的提纯材料</div>
                {selectedFiles.map(file => (
                  <div key={file.name} className="text-[11px] text-gray-600 truncate bg-white rounded-lg px-2.5 py-1.5 border border-gray-100 flex items-center justify-between">
                    <span className="truncate">{file.name}</span>
                    <span className="text-[9px] text-green-650 bg-green-50 px-1.5 py-0.5 rounded font-bold">已载入</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Step 3：执行提纯 */}
        <section className="rounded-2xl bg-[#202124] border border-gray-900 p-5 text-white flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-3">Step 3 执行</div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
              系统将按顺序完成：清空知识库 → 载入新材料 → 向量化切片 → Dify智能抽提词汇与短语 → 写入艾宾浩斯生词本。
            </p>
          </div>
          <button
            onClick={handleRunWorkflow}
            disabled={selectedFiles.length === 0 || status === 'running'}
            className={`w-full px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center ${
              selectedFiles.length === 0 || status === 'running'
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#FF5722] text-white hover:bg-[#E64A19] cursor-pointer'
            }`}
          >
            {status === 'running' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />处理中...</>
            ) : status === 'success' ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />再次执行</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />开始上传并提纯</>
            )}
          </button>
        </section>
      </div>

      {/* 底部详细进度日志区 */}
      <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">当前进度</div>
            <div className="text-sm font-bold text-[#202124] truncate max-w-[280px]">
              {currentFileName || '等待材料...'}
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            status === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'error'
                ? 'bg-red-100 text-red-650'
                : status === 'running'
                  ? 'bg-[#FF5722]/10 text-[#FF5722]'
                  : 'bg-gray-150 text-gray-400'
          }`}
          >
            {status === 'idle' ? '等候中' : status}
          </span>
        </div>

        <div className="h-2 bg-gray-250 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#FF5722] to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 font-medium leading-relaxed">{currentStep}</div>

        <button
          onClick={() => setShowLogs(prev => !prev)}
          className="mt-4 flex items-center text-[11px] font-black uppercase tracking-widest text-gray-450 hover:text-[#202124] transition-colors"
        >
          {showLogs ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          查看提纯流水线详细日志
        </button>

        {showLogs && (
          <div className="mt-3 bg-[#202124] text-gray-300 rounded-xl p-4 max-h-52 overflow-y-auto text-[11px] font-mono space-y-1">
            {logs.length > 0 ? logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <div>等待任务启动...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
