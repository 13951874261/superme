import React, { useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, UploadCloud, Zap } from 'lucide-react';
import { processMaterialsAndExtract } from '../services/difyAPI';

interface MaterialUploaderProps {
  topicHint?: string;
  onUploadSuccess?: (fileName: string) => void;
  onExtractionSuccess?: () => void;
}

type WorkflowStatus = 'idle' | 'running' | 'success' | 'error';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appendLog = (message: string) => {
    setLogs(prev => [...prev, `${nowLabel()} ${message}`]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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

  const handleRunWorkflow = async () => {
    if (selectedFiles.length === 0 || status === 'running') return;

    setStatus('running');
    setShowLogs(true);
    setCurrentStep('后端正在执行：清库 → 上传 → 向量化 → 提纯 → 入库');
    appendLog('启动卡片向导式一键提纯流程');

    try {
      const result = await processMaterialsAndExtract(selectedFiles, topicHint, 'default-user');
      setLogs(result.logs || []);
      const lastResult = result.results?.[result.results.length - 1];
      setCurrentFileName(lastResult?.fileName || selectedFiles[selectedFiles.length - 1]?.name || '全部文件');
      setStatus('success');
      setCurrentStep('全部处理完成');
      selectedFiles.forEach(file => onUploadSuccess?.(file.name));
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

  const progress = status === 'success' ? 100 : status === 'running' ? 65 : selectedFiles.length > 0 ? 25 : 0;

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm mt-8 space-y-6">
      <div>
        <h4 className="text-sm font-black uppercase tracking-widest text-[#202124] mb-2 flex items-center">
          <UploadCloud className="w-5 h-5 mr-2 text-[#FF5722]" />
          一键材料提纯
        </h4>
        <p className="text-xs text-gray-400 font-medium leading-relaxed">
          将材料投喂给 Dify 知识库，并自动写入艾宾浩斯生词本。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-3">Step 1 当前主题</div>
          <div className="text-sm font-black text-[#202124] leading-relaxed">{topicHint}</div>
          <div className="text-[11px] text-gray-400 mt-2">来源：上方 Theme Gateway</div>
        </section>

        <section className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3">Step 2 选择材料</div>
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
            <FileText className="w-4 h-4 mr-2" />选择文档
          </label>
          <div className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            支持 PDF / Word / TXT / MD
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-3 space-y-1">
              {selectedFiles.map(file => (
                <div key={file.name} className="text-[11px] text-gray-600 truncate bg-white rounded-lg px-2 py-1 border border-gray-100">
                  {file.name}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-[#202124] border border-gray-900 p-5 text-white">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#FF5722] mb-3">Step 3 执行</div>
          <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
            系统将按顺序完成：上传 → 向量化 → 提纯 → 入库。
          </p>
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

      <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">当前进度</div>
            <div className="text-sm font-bold text-[#202124]">
              {currentFileName || '等待材料'}
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
            status === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'error'
                ? 'bg-red-100 text-red-600'
                : status === 'running'
                  ? 'bg-[#FF5722]/10 text-[#FF5722]'
                  : 'bg-gray-100 text-gray-400'
          }`}
          >
            {status}
          </span>
        </div>

        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#FF5722] to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 font-medium">{currentStep}</div>

        <button
          onClick={() => setShowLogs(prev => !prev)}
          className="mt-4 flex items-center text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-[#202124] transition-colors"
        >
          {showLogs ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          查看详细日志
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
